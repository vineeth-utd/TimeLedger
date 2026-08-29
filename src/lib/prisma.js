import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg' // [PERF-TMP]

function createPrismaClient() {
  // [PERF-TMP] Using an explicit pg.Pool (instead of a bare config object)
  // purely so we can attach observability listeners below. Same
  // connectionString, no pool options changed (still pg-pool's defaults).
  const pool = new Pool({ connectionString: process.env.DATABASE_URL }) // [PERF-TMP]

  // [PERF-TMP] pool-level instrumentation — remove after investigation
  pool.on('connect', () => { // [PERF-TMP]
    console.log(`[PERF-TMP] ${Date.now()} pg.Pool connect (new physical connection) | total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`) // [PERF-TMP]
  }) // [PERF-TMP]
  pool.on('acquire', () => { // [PERF-TMP]
    console.log(`[PERF-TMP] ${Date.now()} pg.Pool acquire | total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`) // [PERF-TMP]
  }) // [PERF-TMP]
  pool.on('remove', () => { // [PERF-TMP]
    console.log(`[PERF-TMP] ${Date.now()} pg.Pool remove | total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`) // [PERF-TMP]
  }) // [PERF-TMP]
  pool.on('error', (err) => { // [PERF-TMP]
    console.log(`[PERF-TMP] pg.Pool error: ${err.message}`) // [PERF-TMP]
  }) // [PERF-TMP]

  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({
    adapter,
    log: [{ emit: 'event', level: 'query' }], // [PERF-TMP]
  })

  // [PERF-TMP] Prisma-reported SQL execution duration (per statement)
  client.$on('query', (e) => { // [PERF-TMP]
    console.log(`[PERF-TMP] ${Date.now()} prisma query event: ${e.duration}ms | ${e.query.slice(0, 100)}`) // [PERF-TMP]
  }) // [PERF-TMP]

  // [PERF-TMP] wall-clock wrapper around every Prisma Client call — includes
  // any time spent waiting for a pool connection, unlike the event above.
  return client.$extends({ // [PERF-TMP]
    query: { // [PERF-TMP]
      $allOperations({ model, operation, args, query }) { // [PERF-TMP]
        const start = performance.now() // [PERF-TMP]
        return query(args).finally(() => { // [PERF-TMP]
          const ms = (performance.now() - start).toFixed(1) // [PERF-TMP]
          console.log(`[PERF-TMP] prisma call ${model}.${operation}: ${ms}ms`) // [PERF-TMP]
        }) // [PERF-TMP]
      }, // [PERF-TMP]
    }, // [PERF-TMP]
  }) // [PERF-TMP]
}

const globalForPrisma = globalThis
const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export default prisma
