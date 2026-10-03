import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

export function toErrorResponse(error: unknown): { statusCode: number; body: { error: string; details?: unknown } } {
  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
      .join("; ");
    return { statusCode: 400, body: { error: `Invalid request: ${message}`, details: error.issues } };
  }
  const err = error as Error & { statusCode?: number; details?: unknown };
  return {
    statusCode: err.statusCode ?? 500,
    body: {
      error: err.message ?? "Internal server error",
      ...(err.details ? { details: err.details } : {})
    }
  };
}

export function sendError(reply: FastifyReply, error: unknown) {
  const { statusCode, body } = toErrorResponse(error);
  return reply.code(statusCode).send(body);
}

/**
 * Catch-all so handlers that throw (or forget a try/catch) still answer with the
 * same `{ error }` shape, and validation errors become 400 instead of 500.
 */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = toErrorResponse(error);
    if (statusCode >= 500) request.log.error({ err: error }, "Unhandled request error");
    return reply.code(statusCode).send(body);
  });
}
