import { Pool, PoolClient, QueryResultRow } from "pg";

// One pool per server process (kept on globalThis so dev hot-reload doesn't leak connections).
const g = globalThis as unknown as { __nvPool?: Pool };

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /localhost|127\.0\.0\.1|host=\//.test(url);
  return new Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5,
  });
}

export function pool(): Pool {
  if (!g.__nvPool) g.__nvPool = makePool();
  return g.__nvPool;
}

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

/** Runs fn inside BEGIN ... COMMIT; any thrown error triggers ROLLBACK. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** pgvector literal: [0.1,0.2,...] */
export const toVector = (v: number[]) => `[${v.join(",")}]`;
