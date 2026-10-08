import { MemorySaver } from '@langchain/langgraph'

// Development checkpointer: conversation state lives in this server process only (lost on
// restart, not shared across serverless instances). Replace this with a persistent
// PostgreSQL checkpointer before production / when durable interrupts are needed (Milestone 5).
// Kept on globalThis so Next.js dev hot reloads don't drop active threads.
export function getCheckpointer() {
  if (!globalThis.__timeLedgerCheckpointer) {
    globalThis.__timeLedgerCheckpointer = new MemorySaver()
  }
  return globalThis.__timeLedgerCheckpointer
}
