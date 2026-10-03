// Real house data from Dutch public registers:
//   - PDOK Locatieserver: address → BAG verblijfsobject id                (free, no key)
//   - BAG (Kadaster, via PDOK OGC API): floor area, use, build year, footprint (free, no key)
//   - EP-Online (RVO): registered energy label + house type        (free key: EP_ONLINE_API_KEY)
// House type (terraced / corner / semi-detached / detached) is derived from which
// neighbouring buildings share a wall with this one, when EP-Online has no answer.
import type { House, HouseType, Label } from "./engine";

const LOCATIESERVER = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const BAG = "https://api.pdok.nl/kadaster/bag/ogc/v2/collections";
const EP_ONLINE = "https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject";
const TIMEOUT_MS = 8000;

export type LookupResult = House | { error: string } | { ambiguous: string[] };

const cache = new Map<string, Promise<LookupResult>>();

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return (await res.json()) as T;
}

export function normalizePostcode(pc: string): string | null {
  const m = String(pc ?? "").toUpperCase().replace(/\s+/g, "").match(/^([1-9][0-9]{3})([A-Z]{2})$/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** "12", "12A", "12 a", "12-2", "12-H", "12 bis" → number + suffix (letter or toevoeging). */
export function parseHouseNumber(raw: string): { number: number; suffix: string } | null {
  const m = String(raw ?? "").trim().toUpperCase().match(/^(\d{1,5})\s*[- ]?\s*([A-Z0-9]{0,4})$/);
  return m ? { number: Number(m[1]), suffix: m[2] ?? "" } : null;
}

interface AddressDoc {
  weergavenaam: string;
  adresseerbaarobject_id: string;
  huisletter?: string;
  huisnummertoevoeging?: string;
}

interface Vbo {
  properties: { oppervlakte: number; gebruiksdoel: string | string[]; "pand.href": string[] };
}

interface Pand {
  properties: { identificatie: string; bouwjaar: number; aantal_verblijfsobjecten: number; gebruiksdoel?: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

async function resolveAddress(postcode: string, houseNumber: string): Promise<AddressDoc | { error: string } | { ambiguous: string[] }> {
  const pc = normalizePostcode(postcode);
  if (!pc) return { error: `"${postcode}" is not a valid Dutch postcode (expected e.g. 1072 AB).` };
  const hn = parseHouseNumber(houseNumber);
  if (!hn) return { error: `"${houseNumber}" is not a valid house number.` };

  const params = new URLSearchParams({ q: "*", rows: "50", fl: "weergavenaam,adresseerbaarobject_id,huisletter,huisnummertoevoeging" });
  const url = `${LOCATIESERVER}?${params}&fq=type:adres&fq=postcode:${pc}&fq=huisnummer:${hn.number}`;
  const data = await getJson<{ response: { docs: AddressDoc[] } }>(url);
  const docs = data.response.docs;
  if (!docs.length) return { error: `No address found for ${pc} ${houseNumber} in the BAG. Check the postcode and house number.` };

  const suffixOf = (d: AddressDoc) => `${d.huisletter ?? ""}${d.huisnummertoevoeging ?? ""}`.toUpperCase();
  const exact = docs.filter((d) => suffixOf(d) === hn.suffix);
  if (exact.length === 1) return exact[0];
  if (docs.length === 1 && !hn.suffix) return docs[0];
  // A number with several units (12-1, 12-2, 12-H…) and no suffix given: ask which one.
  return { ambiguous: docs.map((d) => d.weergavenaam).sort() };
}

// ---------- house type from building geometry ----------

type Ring = [number, number][];

function rings(p: Pand): Ring[] {
  const g = p.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
  return polys.map((poly) => poly[0] as Ring);
}

function toMeters(ring: Ring, lat0: number): Ring {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return ring.map(([lon, lat]) => [lon * kx, lat * 110540]);
}

function area(r: Ring): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(s / 2);
}

function distPointSeg(p: [number, number], a: [number, number], b: [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Two footprints share a wall if at least two vertices of one lie on the other's outline. */
function sharesWall(a: Ring, b: Ring): boolean {
  const near = (pts: Ring, other: Ring) => pts.filter((p) => other.some((_, i) => i < other.length - 1 && distPointSeg(p, other[i], other[i + 1]) < 0.35)).length;
  return near(a, b) + near(b, a) >= 2;
}

async function inferHouseType(pand: Pand): Promise<HouseType | null> {
  if (pand.properties.aantal_verblijfsobjecten > 1) return "appartement";
  const all = rings(pand).flat();
  const lons = all.map((c) => c[0]);
  const lats = all.map((c) => c[1]);
  const pad = 0.0004; // ~30–45 m: enough to see the neighbours' neighbours
  const bbox = [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad].join(",");
  const data = await getJson<{ features: Pand[] }>(`${BAG}/pand/items?f=json&limit=500&bbox=${bbox}`);
  const lat0 = lats[0];

  // Ignore sheds and garages: anything under 30 m² of footprint.
  const shapes = data.features
    .map((f) => ({ id: f.properties.identificatie, rings: rings(f).map((r) => toMeters(r, lat0)) }))
    .filter((s) => s.rings.reduce((t, r) => t + area(r), 0) >= 30);
  const touches = (x: (typeof shapes)[number], y: (typeof shapes)[number]) => x.rings.some((a) => y.rings.some((b) => sharesWall(a, b)));
  const self = shapes.find((s) => s.id === pand.properties.identificatie);
  if (!self) return null;
  const neighbours = shapes.filter((s) => s.id !== self.id && touches(self, s));

  if (neighbours.length === 0) return "vrijstaand";
  if (neighbours.length >= 2) return "rijtjeshuis";
  // One shared wall: a corner house if the row continues beyond the neighbour, otherwise semi-detached.
  const n = neighbours[0];
  const continues = shapes.some((s) => s.id !== self.id && s.id !== n.id && touches(n, s));
  return continues ? "hoekwoning" : "twee-onder-een-kap";
}

// ---------- energy label ----------

interface EpLabel {
  Energieklasse?: string | null;
  Gebouwtype?: string | null;
  Registratiedatum?: string | null;
  IsVereenvoudigdLabel?: boolean | null;
}

function toLabel(klasse: string): Label | null {
  const k = klasse.trim().toUpperCase();
  if (k.startsWith("A")) return "A";
  return (["B", "C", "D", "E", "F", "G"] as const).find((l) => l === k) ?? null;
}

function typeFromEp(gebouwtype: string): HouseType | null {
  const t = gebouwtype.toLowerCase();
  if (t.includes("appartement") || t.includes("flat") || t.includes("maisonnette") || t.includes("portiek") || t.includes("galerij")) return "appartement";
  if (t.includes("tussen")) return "rijtjeshuis";
  if (t.includes("hoek")) return "hoekwoning";
  if (t.includes("2 onder 1") || t.includes("twee onder") || t.includes("2-onder-1")) return "twee-onder-een-kap";
  if (t.includes("vrijstaand")) return "vrijstaand";
  return null;
}

async function fetchLabel(vboId: string): Promise<EpLabel | null> {
  const key = process.env.EP_ONLINE_API_KEY;
  if (!key) return null;
  try {
    const labels = await getJson<EpLabel[]>(`${EP_ONLINE}/${vboId}`, { Authorization: key });
    return labels.sort((a, b) => String(b.Registratiedatum).localeCompare(String(a.Registratiedatum)))[0] ?? null;
  } catch {
    return null; // label is a nice-to-have; fall back to an estimate
  }
}

/** Rough label estimate by construction period, used only when no registered label is available. */
export function estimateLabel(buildYear: number): Label {
  if (buildYear < 1930) return "F";
  if (buildYear < 1965) return "E";
  if (buildYear < 1975) return "D";
  if (buildYear < 1992) return "C";
  if (buildYear < 2006) return "B";
  return "A";
}

async function lookupUncached(postcode: string, houseNumber: string): Promise<LookupResult> {
  try {
    const addr = await resolveAddress(postcode, houseNumber);
    if ("error" in addr || "ambiguous" in addr) return addr;

    const vboData = await getJson<{ features: Vbo[] }>(`${BAG}/verblijfsobject/items?f=json&identificatie=${addr.adresseerbaarobject_id}`);
    const vbo = vboData.features[0];
    if (!vbo) return { error: `The BAG has no building record for ${addr.weergavenaam}.` };
    const uses = [vbo.properties.gebruiksdoel].flat();
    if (!uses.includes("woonfunctie")) {
      return { error: `${addr.weergavenaam} is registered in the BAG as "${uses.join(", ")}", not as a home. Check the address, or pass the house details as overrides.` };
    }
    const pandHref = vbo.properties["pand.href"]?.[0];
    if (!pandHref) return { error: `The BAG has no building linked to ${addr.weergavenaam}.` };

    const [pand, ep] = await Promise.all([getJson<Pand>(`${pandHref}${pandHref.includes("?") ? "&" : "?"}f=json`), fetchLabel(addr.adresseerbaarobject_id)]);
    const use = uses.join(", ");

    const epType = ep?.Gebouwtype ? typeFromEp(ep.Gebouwtype) : null;
    const type = epType ?? (await inferHouseType(pand).catch(() => null));
    const epLabel = ep?.Energieklasse ? toLabel(ep.Energieklasse) : null;
    const buildYear = pand.properties.bouwjaar;

    return {
      postcode: `${addr.weergavenaam.match(/\b(\d{4})([A-Z]{2})\b/)?.slice(1).join(" ") ?? postcode}`,
      houseNumber: String(houseNumber).trim(),
      address: addr.weergavenaam,
      buildYear,
      type: type ?? "rijtjeshuis",
      floorArea: vbo.properties.oppervlakte,
      label: epLabel ?? estimateLabel(buildYear),
      labelSource: epLabel ? `EP-Online (registered${ep?.Registratiedatum ? ` ${ep.Registratiedatum.slice(0, 10)}` : ""})` : "estimated from build year — no registered label retrieved",
      typeSource: epType ? "EP-Online" : type ? "derived from BAG building footprints" : "unknown — assumed terraced",
      use,
      source: `BAG (Kadaster) via PDOK${epLabel ? " + EP-Online" : ""}`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { error: `Couldn't reach the public registers (${reason}). Ask the user for build year, house type, floor area and label, and pass them as overrides.` };
  }
}

export function lookupHouse(postcode: string, houseNumber: string): Promise<LookupResult> {
  const key = `${normalizePostcode(postcode) ?? postcode}|${String(houseNumber).trim().toUpperCase()}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = lookupUncached(postcode, houseNumber);
    cache.set(key, hit);
    // Don't keep failures around: a transient register outage shouldn't stick.
    hit.then((r) => "error" in r && cache.delete(key));
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  }
  return hit;
}
