import { createInterface } from "node:readline";
import { startCoachLoop } from "./coach-loop";
import { defaultConfig, loadConfig } from "./config";
import { printLoopEvent, printSetupEvent } from "./output";
import type { Plan } from "./planner";
import { runSetupFlow } from "./setup-flow";

const CONFIG_PATH = "./config.json";
const abortController = new AbortController();

// --- 設定読み込み ---
printSetupEvent({ kind: "setup_started" });

const configResult = await loadConfig(CONFIG_PATH);
let config = defaultConfig;

if (configResult.isOk) {
  config = configResult.config;
  printSetupEvent({ kind: "config_loaded", configPath: CONFIG_PATH });
} else {
  switch (configResult.errorCode) {
    case "FILE_NOT_FOUND":
      printSetupEvent({ kind: "config_not_found" });
      break;
    case "PARSE_FAILED":
    case "VALIDATION_FAILED":
      printSetupEvent({ kind: "config_error", message: configResult.message });
      process.exit(1);
  }
}

// --- セットアップフロー ---
const setupResult = await runSetupFlow(abortController.signal);

let displayId: string | undefined;
let referenceImagePath: string | null = null;
let plan: Plan | null = null;

if (setupResult.isOk) {
  displayId = setupResult.setup.displayId;
  referenceImagePath = setupResult.setup.referenceImagePath;
  plan = setupResult.setup.plan;
  printSetupEvent({ kind: "setup_complete", displayName: setupResult.setup.displayName });
} else {
  switch (setupResult.errorCode) {
    case "USER_CANCELLED":
      printSetupEvent({ kind: "setup_failed", message: setupResult.message });
      process.exit(0);
      break; // eslint: process.exit()の後だが、switchの慣例としてbreakを残す
    case "DISPLAY_LIST_FAILED":
    case "NO_DISPLAYS":
    case "PLAN_GENERATION_FAILED":
      printSetupEvent({ kind: "setup_failed", message: setupResult.message });
      console.log("  プランなしでコーチングループを開始します。\n");
      break;
  }
}

// --- コーチングループ ---
const rl = createInterface({ input: process.stdin });

process.on("SIGINT", () => {
  printLoopEvent({ kind: "stopped" });
  rl.close();
  abortController.abort();
  setTimeout(() => process.exit(1), 3_000).unref();
});

printLoopEvent({ kind: "started" });

const { loopFinished, submitMessage } = startCoachLoop({
  config,
  signal: abortController.signal,
  onEvent: printLoopEvent,
  displayId,
  referenceImagePath,
  plan,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (trimmed.length > 0) {
    submitMessage(trimmed);
  }
});

await loopFinished;
