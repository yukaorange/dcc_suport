import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type CapturedImage, captureScreen } from "./capture";
import type { CoachConfig } from "./config";
import { computeDiff } from "./diff";
import { checkSessionContinuity, type EngineResult, invokeClaude } from "./engine";
import { buildCoachSystemPrompt, buildCoachUserPrompt } from "./prompts";

type CoachAdvice = {
  readonly content: string;
  readonly roundIndex: number;
  readonly timestampMs: number;
};

type LoopEvent =
  | { readonly kind: "started" }
  | { readonly kind: "capture_failed"; readonly message: string }
  | { readonly kind: "diff_skipped"; readonly reason: string }
  | { readonly kind: "no_change"; readonly diffRatePercent: number }
  | { readonly kind: "user_message_received"; readonly message: string }
  | { readonly kind: "querying" }
  | { readonly kind: "advice"; readonly advice: CoachAdvice }
  | { readonly kind: "silent" }
  | { readonly kind: "engine_error"; readonly message: string }
  | { readonly kind: "session_lost"; readonly reason: string }
  | { readonly kind: "stopped" };

export type { LoopEvent, CoachAdvice };

type MessageBox = {
  readonly submit: (message: string) => void;
  readonly consume: () => string | null;
  readonly awaitMessage: () => Promise<void>;
};

function createMessageBox(): MessageBox {
  const queue: string[] = [];
  let wakeResolve: (() => void) | null = null;

  return {
    submit: (message: string) => {
      queue.push(message);
      wakeResolve?.();
    },
    consume: () => {
      return queue.shift() ?? null;
    },
    awaitMessage: () =>
      new Promise<void>((resolve) => {
        wakeResolve = resolve;
      }),
  };
}

type CoachLoopOptions = {
  readonly config: CoachConfig;
  readonly signal: AbortSignal;
  readonly onEvent: (event: LoopEvent) => void;
};

type CoachLoopHandle = {
  readonly loopFinished: Promise<void>;
  readonly submitMessage: (message: string) => void;
};

export type { CoachLoopOptions, CoachLoopHandle };

type LoopState = {
  readonly previousImage: CapturedImage | null;
  readonly sessionId: string | undefined;
  readonly roundIndex: number;
};

const INITIAL_STATE: LoopState = {
  previousImage: null,
  sessionId: undefined,
  roundIndex: 0,
};

const SILENT_MARKER = "__SILENT__";

const TEMP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".coach-tmp");
const SCREENSHOT_PATH = join(TEMP_DIR, "current.png");

type DiffCheckResult =
  | { readonly shouldInvoke: true }
  | { readonly shouldInvoke: false; readonly event: LoopEvent };

function checkScreenDiff(
  currentImage: CapturedImage,
  previousImage: CapturedImage,
  config: CoachConfig,
): DiffCheckResult {
  const diffResult = computeDiff({
    currentPixels: currentImage.rawPixels,
    currentWidthPx: currentImage.widthPx,
    currentHeightPx: currentImage.heightPx,
    previousPixels: previousImage.rawPixels,
    previousWidthPx: previousImage.widthPx,
    previousHeightPx: previousImage.heightPx,
    pixelmatchThreshold: config.pixelmatchThreshold,
  });

  if (!diffResult.isOk) {
    return {
      shouldInvoke: false,
      event: {
        kind: "diff_skipped",
        reason: `[${diffResult.errorCode}] ${diffResult.message}`,
      },
    };
  }

  if (diffResult.diffRatePercent < config.diffThresholdPercent) {
    return {
      shouldInvoke: false,
      event: { kind: "no_change", diffRatePercent: diffResult.diffRatePercent },
    };
  }

  return { shouldInvoke: true };
}

function parseAdvice(result: string): string | null {
  const trimmed = result.trim();
  if (trimmed === SILENT_MARKER) return null;
  return trimmed;
}

function deriveNextState(
  current: LoopState,
  newImage: CapturedImage,
  engineResult: EngineResult | null,
): LoopState {
  const sessionId = engineResult?.isOk
    ? (engineResult.sessionId ?? current.sessionId)
    : current.sessionId;

  return {
    previousImage: newImage,
    sessionId,
    roundIndex: current.roundIndex + 1,
  };
}

async function ensureTempDir(): Promise<void> {
  await mkdir(TEMP_DIR, { recursive: true });
}

async function saveScreenshot(pngBuffer: Buffer): Promise<string> {
  await writeFile(SCREENSHOT_PATH, pngBuffer);
  return SCREENSHOT_PATH;
}

async function cleanupTemp(): Promise<void> {
  // @throws — ファイルが存在しない場合のエラーは無視
  await unlink(SCREENSHOT_PATH).catch(() => {});
}

// 次のラウンドまで待機する。以下の3つのうち最初に起きたもので起きる:
//   ① タイマー満了（durationMs 経過）
//   ② abort シグナル（Ctrl+C）
//   ③ ユーザーがメッセージを入力
//
// JS に「レースして負けた方を片付ける」仕組みがないため、
// settled フラグで二重実行を防ぎ、cleanup で敗者側のタイマー/リスナーを手動で外している。
function sleepOrUserInput(
  durationMs: number,
  signal: AbortSignal,
  messageBox: MessageBox,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false; //レース決着がついたか否か

    // どのトリガーで起きても、最終的にこの関数が1回だけ呼ばれる
    const wakeUp = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    // ① ② ③ を同時に仕掛ける
    const timer = setTimeout(wakeUp, durationMs); // ①

    const onAbort = () => wakeUp(); // ②
    signal.addEventListener("abort", onAbort, { once: true });

    messageBox.awaitMessage().then(wakeUp); // ③

    // 勝者が決まったら、タイマーと abort リスナーを片付ける
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };
  });
}

// 1ラウンド分の処理を実行し、次のラウンド用の LoopState を返す。
// 異常系は早期リターンで抜け、正常系だけが最後まで到達する構造。
//
//   ① ユーザーメッセージがあれば通知
//   ② 画面キャプチャ → 失敗なら return
//   ③ 前回画像との diff 判定 → 変化なしなら return（初回・ユーザーメッセージ時はスキップ）
//   ④ スクリーンショットを一時ファイルに保存
//   ⑤ AI に問い合わせ → エラーなら return
//   ⑥ セッション継続確認 → 途切れたら sessionId リセットして return
//   ⑦ 応答を解析し、advice or silent イベントを発火
async function executeOneRound(
  state: LoopState,
  options: CoachLoopOptions,
  userMessage: string | null,
): Promise<LoopState> {
  const { config, onEvent } = options;

  if (userMessage !== null) {
    onEvent({ kind: "user_message_received", message: userMessage });
  }

  // @throws — OS レベルのキャプチャ失敗
  const captureResult = await captureScreen({
    maxWidthPx: config.maxImageWidthPx,
  });
  if (!captureResult.isOk) {
    onEvent({
      kind: "capture_failed",
      message: `[${captureResult.errorCode}] ${captureResult.message}`,
    });
    return { ...state, roundIndex: state.roundIndex + 1 };
  }

  const currentImage = captureResult.image;
  const hasUserMessage = userMessage !== null;

  if (state.previousImage !== null && !hasUserMessage) {
    const diffCheckResult = checkScreenDiff(currentImage, state.previousImage, config);
    if (!diffCheckResult.shouldInvoke) {
      onEvent(diffCheckResult.event);
      return deriveNextState(state, currentImage, null);
    }
  }

  const screenshotPath = await saveScreenshot(currentImage.pngBuffer);

  onEvent({ kind: "querying" });

  const isFirstRound = state.previousImage === null;

  // @throws — SDK レベルのエラー
  const engineResult = await invokeClaude({
    prompt: buildCoachUserPrompt({ screenshotPath, isFirstRound, userMessage }),
    sessionId: state.sessionId,
    appendSystemPrompt: buildCoachSystemPrompt(),
    permissionMode: "bypassPermissions",
    allowedTools: [],
    maxTurns: 3,
    timeoutMs: 60_000,
    signal: options.signal,
  });

  if (!engineResult.isOk) {
    if (engineResult.errorCode !== "ABORTED") {
      onEvent({
        kind: "engine_error",
        message: `[${engineResult.errorCode}] ${engineResult.message}`,
      });
    }
    return deriveNextState(state, currentImage, engineResult);
  }

  const continuity = checkSessionContinuity(engineResult, isFirstRound);
  if (!continuity.continuable) {
    onEvent({ kind: "session_lost", reason: continuity.reason });
    return {
      previousImage: currentImage,
      sessionId: undefined,
      roundIndex: state.roundIndex + 1,
    };
  }

  const advice = parseAdvice(engineResult.result);
  if (advice === null) {
    onEvent({ kind: "silent" });
  } else {
    onEvent({
      kind: "advice",
      advice: {
        content: advice,
        roundIndex: state.roundIndex,
        timestampMs: Date.now(),
      },
    });
  }

  return deriveNextState(state, currentImage, engineResult);
}

export function startCoachLoop(options: CoachLoopOptions): CoachLoopHandle {
  const messageBox = createMessageBox();

  const loopFinished = (async () => {
    await ensureTempDir();

    let state: LoopState = INITIAL_STATE;

    try {
      while (!options.signal.aborted) {
        const userMessage = messageBox.consume();
        state = await executeOneRound(state, options, userMessage);

        if (options.signal.aborted) break;
        await sleepOrUserInput(options.config.intervalSeconds * 1000, options.signal, messageBox);
      }
    } finally {
      await cleanupTemp();
    }
  })();

  return { loopFinished, submitMessage: messageBox.submit };
}
