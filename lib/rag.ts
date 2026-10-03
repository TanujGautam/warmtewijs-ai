// Retrieval-augmented generation: a small BM25 index over the knowledge base,
// chunked by "##" section. No embeddings service needed, fully deterministic,
// and good enough for a corpus this size (swap for a vector store when it grows).
import { KNOWLEDGE } from "./generated/content";

export interface Chunk {
  id: string; // e.g. "isde-2026#the-two-measure-rule"
  docId: string;
  title: string;
  heading: string;
  source: string;
  text: string;
}

export interface Hit extends Chunk {
  score: number;
}

const STOP = new Set(
  "the a an and or of to in on for is are be with by it this that as at from your you i my me we do does what which how when should can de het een en van is".split(" "),
);

// Light bilingual synonym expansion so Dutch questions hit English docs and vice versa.
const SYNONYMS: Record<string, string[]> = {
  warmtepomp: ["heat", "pump"],
  isolatie: ["insulation"],
  spouwmuur: ["cavity", "wall"],
  dak: ["roof"],
  vloer: ["floor"],
  glas: ["glazing", "glass"],
  subsidie: ["subsidy", "isde"],
  zonnepanelen: ["solar", "panels"],
  huurder: ["tenant", "renter"],
  huur: ["rent", "tenant"],
  verhuurder: ["landlord"],
  lening: ["loan"],
  label: ["energy", "label"],
  renter: ["tenant"],
  rent: ["tenant"],
  hybrid: ["hybride"],
  netmetering: ["saldering"],
};

export function tokenize(s: string): string[] {
  const base = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
  const out: string[] = [];
  for (const t of base) {
    out.push(t);
    for (const [k, vs] of Object.entries(SYNONYMS)) if (t.startsWith(k)) out.push(...vs);
  }
  return out;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function buildChunks(): Chunk[] {
  const chunks: Chunk[] = [];
  for (const doc of KNOWLEDGE) {
    const parts = doc.body.split(/^## /m).filter((p) => p.trim());
    for (const part of parts) {
      const [heading, ...rest] = part.split("\n");
      chunks.push({
        id: `${doc.id}#${slug(heading)}`,
        docId: doc.id,
        title: doc.title,
        heading: heading.trim(),
        source: doc.source,
        text: rest.join("\n").trim(),
      });
    }
  }
  return chunks;
}

const CHUNKS = buildChunks();
const DOC_TOKENS = CHUNKS.map((c) => tokenize(`${c.title} ${c.heading} ${c.heading} ${c.text}`));
const AVG_LEN = DOC_TOKENS.reduce((s, t) => s + t.length, 0) / DOC_TOKENS.length;
const DF = new Map<string, number>();
for (const toks of DOC_TOKENS) for (const t of new Set(toks)) DF.set(t, (DF.get(t) ?? 0) + 1);

export function search(query: string, k = 3): Hit[] {
  const q = [...new Set(tokenize(query))];
  const N = CHUNKS.length;
  const k1 = 1.4;
  const b = 0.75;
  const scored = CHUNKS.map((chunk, i) => {
    const toks = DOC_TOKENS[i];
    let score = 0;
    for (const term of q) {
      const tf = toks.filter((t) => t === term).length;
      if (!tf) continue;
      const df = DF.get(term) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * toks.length) / AVG_LEN)));
    }
    return { ...chunk, score: Math.round(score * 100) / 100 };
  });
  return scored.filter((h) => h.score > 0).sort((x, y) => y.score - x.score).slice(0, k);
}

export const CHUNK_COUNT = CHUNKS.length;
