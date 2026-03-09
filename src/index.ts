import { createInterface } from "node:readline";
import { startCoachLoop } from "./coach-loop";
import { defaultConfig } from "./config";
import { printLoopEvent } from "./output";

const abortController = new AbortController();

const rl = createInterface({ input: process.stdin });

process.on("SIGINT", () => {
  printLoopEvent({ kind: "stopped" });
  rl.close();
  abortController.abort();
});

printLoopEvent({ kind: "started" });

const { loopFinished, submitMessage } = startCoachLoop({
  config: defaultConfig,
  signal: abortController.signal,
  onEvent: printLoopEvent,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (trimmed.length > 0) {
    submitMessage(trimmed);
  }
});

// ctrl+cで終了するまでループを継続させる。
await loopFinished;
