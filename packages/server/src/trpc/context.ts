import type { CoachConfig } from "@dcc/core";
import type { DrizzleDb } from "../db/database";
import type { CoachSessionHandle } from "../lib/coach-session";
import type { EventBus } from "../pure/event-bus";
import type { PendingPlanCache } from "../pure/pending-plan-cache";

type AppContext = {
  readonly db: DrizzleDb;
  readonly eventBus: EventBus;
  readonly config: CoachConfig;
  readonly coachSession: CoachSessionHandle;
  readonly pendingPlanCache: PendingPlanCache;
};

export type { AppContext };
