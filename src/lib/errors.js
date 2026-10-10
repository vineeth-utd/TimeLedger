// Business-rule error thrown by the service layer. `status` is the HTTP status
// the REST API responds with; AI tools use `code` and `message`.
export class ServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.status = status
  }
}

// Shared catch-block handler for API routes.
export function handleRouteError(error, label) {
  if (error instanceof ServiceError) {
    return Response.json({ success: false, message: error.message }, { status: error.status })
  }
  console.error(`${label} error:`, error)
  return Response.json({ success: false, message: 'Internal server error' }, { status: 500 })
}

// Prisma unique-constraint violation (e.g. a duplicate created by a concurrent request).
export function isUniqueViolation(error) {
  return error?.code === 'P2002'
}
