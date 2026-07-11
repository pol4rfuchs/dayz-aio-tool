import type { FastifyReply } from "fastify";

export function sendError(reply: FastifyReply, error: unknown) {
  const err = error as Error & { statusCode?: number; details?: unknown };
  const statusCode = err.statusCode ?? 500;
  return reply.code(statusCode).send({
    error: err.message ?? "Internal server error",
    ...(err.details ? { details: err.details } : {})
  });
}
