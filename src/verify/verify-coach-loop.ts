import type { LoopEvent } from "../coach-loop";
import { startCoachLoop } from "../coach-loop";
import { defaultConfig } from "../config";
import { printLoopEvent } from "../output";
import { printVerifyResult, type VerifyResult } from "./types";

export async function verifyCoachLoop(): Promise<VerifyResult> {
  const start = performance.now();
  const events: LoopEvent[] = [];

  const abortController = new AbortController();

  let roundCount = 0;
  const maxRounds = 2;

  const TIMEOUT_MS = 120_000;
  const timeoutTimer = setTimeout(() => {
    abortController.abort();
  }, TIMEOUT_MS);

  const onEvent = (event: LoopEvent) => {
    events.push(event);
    printLoopEvent(event);
    switch (event.kind) {
      case "advice":
      case "silent":
      case "engine_error": {
        roundCount++;
        if (roundCount >= maxRounds) {
          clearTimeout(timeoutTimer);
          abortController.abort();
        }
        break;
      }
    }
  };

  // @throws — 予期せぬエラーが発生する可能性がある
  try {
    const { loopFinished } = startCoachLoop({
      config: { ...defaultConfig, intervalSeconds: 2 },
      signal: abortController.signal,
      onEvent,
      referenceImagePath: null,
      plan: null,
    });
    await loopFinished;
  } catch (e) {
    clearTimeout(timeoutTimer);
    const durationMs = performance.now() - start;
    return {
      status: "fail",
      name: "coach-loop",
      durationMs,
      error: `Unexpected: ${e instanceof Error ? e.message : String(e)}`,
      fallback: "coach-loop.ts の実装を確認",
    };
  }

  clearTimeout(timeoutTimer);
  const durationMs = performance.now() - start;

  if (roundCount === 0) {
    return {
      status: "inconclusive",
      name: "coach-loop",
      durationMs,
      reason: `AI応答なし（タイムアウトまたは画面変化なし）。events: ${events.map((e) => e.kind).join(", ")}`,
    };
  }

  const hasAdviceOrSilent = events.some((e) => e.kind === "advice" || e.kind === "silent");

  if (!hasAdviceOrSilent) {
    return {
      status: "fail",
      name: "coach-loop",
      durationMs,
      error: `AI応答なし。events: ${events.map((e) => e.kind).join(", ")}`,
      fallback: "capture/diff/engine の個別検証を再実行",
    };
  }

  return {
    status: "pass",
    name: "coach-loop",
    durationMs,
    detail: `${roundCount} rounds completed. events: ${events.map((e) => e.kind).join(", ")}`,
  };
}

if (import.meta.main) {
  const r = await verifyCoachLoop();
  printVerifyResult(r);
}
