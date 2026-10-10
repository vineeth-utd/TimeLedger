import { MemorySaver } from '@langchain/langgraph'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import pg from 'pg'

// Conversation state and pending confirmations must survive across requests (and serverless
// instances), so the default checkpointer is PostgreSQL, in its own schema so Prisma's `public`
// schema is untouched. Run `node --env-file=.env scripts/ai-setup-checkpointer.mjs` once to
// create the tables. `AI_CHECKPOINTER=memory` selects an in-process saver (tests/local only).
// The instance is kept on globalThis so dev hot reloads don't leak connection pools.
export const CHECKPOINT_SCHEMA = 'ai_checkpoints'

export function createPostgresCheckpointer(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is not configured')
  const pool = new pg.Pool({ connectionString, max: 3 })
  // Idle-connection errors (network drops) must not crash the process; the pool replaces the client.
  pool.on('error', (error) => console.error('AI checkpointer pool error:', error.message))
  return new PostgresSaver(pool, undefined, { schema: CHECKPOINT_SCHEMA })
}

export function getCheckpointer() {
  if (!globalThis.__timeLedgerCheckpointer) {
    globalThis.__timeLedgerCheckpointer =
      process.env.AI_CHECKPOINTER === 'memory' ? new MemorySaver() : createPostgresCheckpointer()
  }
  return globalThis.__timeLedgerCheckpointer
}
