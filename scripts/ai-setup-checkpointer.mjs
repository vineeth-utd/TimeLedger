// One-time setup of the assistant's PostgreSQL checkpoint tables (schema "ai_checkpoints").
// Idempotent. Usage: node --env-file=.env scripts/ai-setup-checkpointer.mjs
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import pg from 'pg'

const SCHEMA = 'ai_checkpoints' // keep in sync with src/lib/ai/checkpointer.js

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required (run with: node --env-file=.env scripts/ai-setup-checkpointer.mjs)')
  process.exit(2)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
try {
  await new PostgresSaver(pool, undefined, { schema: SCHEMA }).setup()
  console.log(`Checkpoint tables ready in schema "${SCHEMA}".`)
} finally {
  await pool.end()
}
