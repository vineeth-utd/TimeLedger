// [PERF-TMP] Throwaway diagnostic route — no auth, isolates the Prisma/pool
// layer from getAuthenticatedUser() so pool concurrency can be tested
// directly. Delete this whole file once the performance investigation is
// done.
import prisma from '@/lib/prisma'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const n = Number(searchParams.get('n') ?? '20')

  const start = performance.now()
  const results = await Promise.allSettled(
    Array.from({ length: n }, (_, i) => {
      const t0 = performance.now()
      return prisma.mainCategory.findMany({ take: 1 }).then((rows) => ({
        i,
        ms: Number((performance.now() - t0).toFixed(1)),
        rows: rows.length,
      }))
    })
  )
  const total = Number((performance.now() - start).toFixed(1))

  return Response.json({
    n,
    total_ms: total,
    results: results.map((r) =>
      r.status === 'fulfilled' ? r.value : { error: r.reason?.message }
    ),
  })
}
