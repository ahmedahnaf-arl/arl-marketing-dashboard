import pg from "pg";

const { Pool } = pg;

const globalForDb = globalThis;

function makePool() {
  // SSL is derived from the connection string (sslmode=require) automatically by pg.
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    connectionTimeoutMillis: 10000,
  });
}

export function getPool() {
  if (!globalForDb.__planPool) {
    globalForDb.__planPool = makePool();
  }
  return globalForDb.__planPool;
}

export async function query(text, params = []) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Set it in .env (local) or in Vercel Environment Variables.");
  }
  const pool = getPool();
  return pool.query(text, params);
}
