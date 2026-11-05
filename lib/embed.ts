import { HttpError } from "./auth";

const BATCH = 64;

/** Calls the FastAPI embedding service; returns one 384-dim vector per input text. */
export async function embed(texts: string[]): Promise<number[][]> {
  const base = process.env.EMBEDDING_URL || "http://localhost:8000";
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    let res: Response;
    try {
      res = await fetch(`${base}/embed`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.EMBEDDING_API_KEY ? { "x-api-key": process.env.EMBEDDING_API_KEY } : {}),
        },
        body: JSON.stringify({ texts: texts.slice(i, i + BATCH) }),
        cache: "no-store",
      });
    } catch {
      throw new HttpError(503, "Embedding service is not reachable. Start it with: uvicorn main:app --port 8000");
    }
    if (!res.ok) throw new HttpError(502, `Embedding service error (${res.status})`);
    const data = (await res.json()) as { dim: number; embeddings: number[][] };
    if (data.dim !== 384) throw new HttpError(500, `Expected 384-dim embeddings, got ${data.dim}`);
    out.push(...data.embeddings);
  }
  return out;
}
