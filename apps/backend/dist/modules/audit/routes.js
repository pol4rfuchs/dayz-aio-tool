import { listAudit } from "./service.js";
export async function auditRoutes(app) {
    app.get("/api/audit", async (request) => {
        const query = request.query;
        return { items: listAudit(query.serverId, Number(query.limit ?? 100)) };
    });
}
