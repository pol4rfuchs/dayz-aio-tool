import fs from "node:fs/promises";
import { readServerDz, saveServerDz, serverDzPayloadSchema, validateServerDz, getServerDzPath } from "./serverDz.js";
import { sendError } from "../../shared/errors.js";
import { lineDiff } from "../diff/service.js";
export async function configRoutes(app) {
    app.get("/serverdz", async (request, reply) => {
        try {
            const { serverId } = request.params;
            return { content: await readServerDz(serverId), path: getServerDzPath(serverId) };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/serverdz/validate", async (request) => {
        const input = serverDzPayloadSchema.parse(request.body);
        return validateServerDz(input.content);
    });
    app.post("/serverdz/diff", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const input = serverDzPayloadSchema.parse(request.body);
            const oldText = await fs.readFile(getServerDzPath(serverId), "utf8");
            return { diff: lineDiff(oldText, input.content) };
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.put("/serverdz", async (request, reply) => {
        try {
            const { serverId } = request.params;
            const input = serverDzPayloadSchema.parse(request.body);
            return await saveServerDz(serverId, input.content);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
