import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultConfig, loadConfig } from "@dcc/core";
import { createApp } from "./app";
import { createDatabase } from "./db/database";
import { createCoachSession } from "./lib/coach-session";
import { createEventBus } from "./pure/event-bus";
import { createPendingPlanCache } from "./pure/pending-plan-cache";
import type { AppContext } from "./trpc/context";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ROOT = join(PACKAGE_ROOT, "..", "..");

const PORT = 3456;
const DB_PATH = join(PACKAGE_ROOT, "sessions", "dcc.sqlite");
const CONFIG_PATH = join(PROJECT_ROOT, "config.json");

const configResult = await loadConfig(CONFIG_PATH);
if (!configResult.isOk) {
  console.warn(`[config] failed to load, using defaults: ${configResult.message}`);
}
const config = configResult.isOk ? configResult.config : defaultConfig;

const db = createDatabase(DB_PATH);
const eventBus = createEventBus();
const pendingPlanCache = createPendingPlanCache();
const coachSession = createCoachSession({ config, eventBus, db });

const createContext = (): AppContext => ({ db, eventBus, config, coachSession, pendingPlanCache });

const app = createApp({ createContext });

// SSE subscription request は長寿命 stream のため、Bun の idleTimeout で
// mid-response 切断されないように個別に timeout 無効化する。
// 参考: https://bun.sh/docs/api/http#server-timeout-request-seconds
Bun.serve({
  port: PORT,
  idleTimeout: 255,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/api/trpc/events.subscribe") {
      server.timeout(req, 0);
    }
    return app.fetch(req);
  },
});

console.log(`DCC Coach server started at http://localhost:${PORT}`);
