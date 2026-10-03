// Current weather for the header. Location: the user's postcode (via PDOK) or De Bilt (KNMI) by default.
// Weather data: Open-Meteo (free for non-commercial use; check their licence before a commercial launch).
import { normalizePostcode } from "@/lib/registers";

const DEFAULT = { lat: 52.1009, lon: 5.1806, place: "De Bilt" };
const geoCache = new Map<string, { lat: number; lon: number; place: string }>();

async function geocode(postcode: string) {
  const pc = normalizePostcode(postcode);
  if (!pc) return DEFAULT;
  const hit = geoCache.get(pc);
  if (hit) return hit;
  try {
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=*&fq=type:postcode&fq=postcode:${pc}&rows=1&fl=centroide_ll,woonplaatsnaam`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const doc = (await res.json()).response?.docs?.[0];
    const m = doc?.centroide_ll?.match(/POINT\(([\d.]+) ([\d.]+)\)/);
    const loc = m ? { lon: Number(m[1]), lat: Number(m[2]), place: doc.woonplaatsnaam ?? pc } : DEFAULT;
    geoCache.set(pc, loc);
    return loc;
  } catch {
    return DEFAULT;
  }
}

export async function GET(req: Request) {
  const postcode = new URL(req.url).searchParams.get("postcode");
  const loc = postcode ? await geocode(postcode) : DEFAULT;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat.toFixed(3)}&longitude=${loc.lon.toFixed(3)}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FAmsterdam`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 600 } });
    if (!res.ok) throw new Error(String(res.status));
    const c = (await res.json()).current;
    return Response.json(
      { temp: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m, place: loc.place },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } },
    );
  } catch {
    return Response.json({ error: "weather unavailable" }, { status: 502 });
  }
}
