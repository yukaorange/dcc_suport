import type { CoachConfig, SdkVersionStatus } from "@dcc/core";
import type { DrizzleDb } from "../db/database";
import type { CoachSessionHandle } from "../lib/coach-session";
import type { ModelCatalog } from "../lib/model-catalog";
import type { EventBus } from "../pure/event-bus";
import type { PendingPlanCache } from "../pure/pending-plan-cache";

type AppContext = {
  readonly db: DrizzleDb;
  readonly eventBus: EventBus;
  readonly config: CoachConfig;
  readonly coachSession: CoachSessionHandle;
  readonly pendingPlanCache: PendingPlanCache;
  readonly modelCatalog: ModelCatalog;
  // 起動時に一度だけ実行されるSDKバージョンチェックの結果（Promise自体がキャッシュ）
  readonly sdkVersionStatus: Promise<SdkVersionStatus>;
};

export type { AppContext };
