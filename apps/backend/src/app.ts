import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { closeDatabase, initDatabase } from "./db/database.js";
import { serverRoutes } from "./modules/servers/routes.js";
import { economyRoutes } from "./modules/economy/routes.js";
import { backupRoutes } from "./modules/backups/routes.js";
import { modRoutes } from "./modules/mods/routes.js";
import { configRoutes } from "./modules/config/routes.js";
import { realtimeRoutes } from "./modules/realtime/routes.js";
import { auditRoutes } from "./modules/audit/routes.js";
import { schedulerRoutes, tickSchedules } from "./modules/scheduler/routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { rconRoutes } from "./modules/rcon/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";
import { systemRoutes } from "./modules/system/routes.js";
import { advancedRoutes } from "./modules/advanced/routes.js";
import { workshopRoutes } from "./modules/workshop/routes.js";
import { crashRoutes } from "./modules/crash/routes.js";
import { doctorRoutes } from "./modules/doctor/routes.js";
import { readinessRoutes } from "./modules/readiness/routes.js";
import { debugRoutes } from "./modules/debug/routes.js";
import { updateRoutes } from "./modules/updates/routes.js";
import { persistenceRoutes } from "./modules/persistence/routes.js";
import { logRoutes } from "./modules/logs/routes.js";
import { heartbeatAllServers } from "./modules/process/service.js";
import { CORS_ORIGINS, HEALTH_TICK_MS, REQUEST_BODY_LIMIT_BYTES, VERSION, assertSecurityConfiguration } from "./shared/env.js";
import { registerBackendFileLogging } from "./shared/logging.js";
import { registerSecurityHooks, securityRoutes } from "./modules/security/auth.js";

export async function buildApp() {
  assertSecurityConfiguration();
  initDatabase();

  const app = Fastify({ logger: true, bodyLimit: REQUEST_BODY_LIMIT_BYTES });
  registerBackendFileLogging(app);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    allowedHeaders: ["content-type", "authorization", "x-api-key"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  registerSecurityHooks(app);
  await app.register(websocket);

  await app.register(securityRoutes);

  app.get("/favicon.ico", async (_request, reply) => reply.code(204).send());

  await app.register(serverRoutes, { prefix: "/api/servers" });
  await app.register(configRoutes, { prefix: "/api/servers/:serverId/config" });
  await app.register(economyRoutes, { prefix: "/api/servers/:serverId/economy" });
  await app.register(backupRoutes, { prefix: "/api/servers/:serverId/backups" });
  await app.register(modRoutes, { prefix: "/api/servers/:serverId/mods" });

  await app.register(realtimeRoutes);
  await app.register(auditRoutes);
  await app.register(schedulerRoutes);
  await app.register(notificationRoutes);
  await app.register(rconRoutes);
  await app.register(analyticsRoutes);
  await app.register(systemRoutes);
  await app.register(advancedRoutes);
  await app.register(workshopRoutes);
  await app.register(crashRoutes);
  await app.register(doctorRoutes);
  await app.register(readinessRoutes);
  await app.register(debugRoutes);
  await app.register(updateRoutes);
  await app.register(persistenceRoutes);
  await app.register(logRoutes);

  app.get("/health", async () => ({ ok: true, service: "dayz-aio-backend", version: VERSION, authRequired: true }));

  const heartbeatTimer = setInterval(() => heartbeatAllServers(), HEALTH_TICK_MS);
  const scheduleTimer = setInterval(() => { void tickSchedules(); }, 30_000);
  app.addHook("onClose", async () => {
    clearInterval(heartbeatTimer);
    clearInterval(scheduleTimer);
    closeDatabase();
  });

  return app;
}
