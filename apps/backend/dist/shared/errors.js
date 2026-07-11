export function sendError(reply, error) {
    const err = error;
    const statusCode = err.statusCode ?? 500;
    return reply.code(statusCode).send({
        error: err.message ?? "Internal server error",
        ...(err.details ? { details: err.details } : {})
    });
}
