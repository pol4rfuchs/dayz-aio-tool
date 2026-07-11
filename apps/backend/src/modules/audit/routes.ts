import type { FastifyInstance } from "fastify";
import { listAudit } from "./service.js";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/api/audit", async (request) => {
    const query = request.query as { serverId?: string; limit?: string };
    return { items: listAudit(query.serverId, Number(query.limit ?? 100)) };
  });
}
