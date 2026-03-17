import { defaultConfig, loadConfig } from "@dcc/core";
import { createApp } from "./app";
import { createCoachSession } from "./lib/coach-session";
import { createDatabase } from "./db/database";
import { createEventBus } from "./pure/event-bus";
import { createPendingPlanCache } from "./pure/pending-plan-cache";
import type { AppContext } from "./trpc/context";

const PORT = 3456;
const DB_PATH = "packages/server/sessions/dcc.sqlite";
const CONFIG_PATH = "./config.json";

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
