import { createManualBackup, deleteBackup, listBackups, readBackupMetadata, restoreBackup } from "./service.js";
import { sendError } from "../../shared/errors.js";
export async function backupRoutes(app) {
    app.get("/", async (request, reply) => {
        try {
            return listBackups(request.params.serverId);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/", async (request, reply) => {
        try {
            return await createManualBackup(request.params.serverId);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.get("/:backupId", async (request, reply) => {
        try {
            const { serverId, backupId } = request.params;
            return await readBackupMetadata(serverId, backupId);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.post("/:backupId/restore", async (request, reply) => {
        try {
            const { serverId, backupId } = request.params;
            return await restoreBackup(serverId, backupId);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
    app.delete("/:backupId", async (request, reply) => {
        try {
            const { serverId, backupId } = request.params;
            return deleteBackup(serverId, backupId);
        }
        catch (error) {
            return sendError(reply, error);
        }
    });
}
