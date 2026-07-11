import { buildApp } from "./app.js";
const app = await buildApp();
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";
let closing = false;
async function shutdown(signal) {
    if (closing)
        return;
    closing = true;
    app.log.warn({ signal }, "DayZ AIO backend shutting down");
    try {
        await app.close();
        process.exit(0);
    }
    catch (error) {
        app.log.error({ error }, "Graceful shutdown failed");
        process.exit(1);
    }
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
    app.log.fatal({ error }, "Uncaught exception");
    void shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
    app.log.fatal({ reason }, "Unhandled rejection");
    void shutdown("unhandledRejection");
});
await app.listen({ host, port });
app.log.info(`DayZ AIO backend listening on ${host}:${port}`);
