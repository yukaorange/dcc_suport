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
const config = configResult.isOk ? configResult.config : defaultConfig;

const db = createDatabase(DB_PATH);
const eventBus = createEventBus();
const pendingPlanCache = createPendingPlanCache();
const coachSession = createCoachSession({ config, eventBus, db });

const createContext = (): AppContext => ({ db, eventBus, config, coachSession, pendingPlanCache });

const app = createApp({ createContext });

Bun.serve({ port: PORT, fetch: app.fetch });

console.log(`DCC Coach server started at http://localhost:${PORT}`);
