import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { buildAgentDefinitions } from "./agents";
import { type CapturedImage, captureScreen } from "./capture";
import type { CoachConfig } from "./config";
import { computeDiff } from "./diff";
import { checkSessionContinuity, type EngineResult, invokeClaude } from "./engine";
import type { LoopMode, RoundTrigger, UserMessage } from "./loop-types";
import { COACH_TEMP_DIR, SKILLS_ROOT } from "./paths";
import type { Plan, PlanStepStatus } from "./planner";
import { buildCoachSystemPrompt, buildCoachUserPrompt, type RestoredAdvice } from "./prompts";
import { createToolPermissionGuard, resolveSkillPath, validateBashCommand } from "./skills";

const ADVISOR_MAX_TURNS = 20;
const ADVISOR_TIMEOUT_MS = 1_800_000;

// ツール実行時にその目的を input から動的に組み立てて返す
function describeToolActivity(toolName: string, input: Record<string, unknown>): string | null {
  switch (toolName) {
    case "Read": {
      const target = typeof input.file_path === "string" ? input.file_path : "ファイル";
      return `${target} を読み取っています...`;
    }
    case "Write": {
      const target = typeof input.file_path === "string" ? input.file_path : "ファイル";
      return `${target} に書き込んでいます...`;
    }
    case "WebSearch": {
      const query = typeof input.query === "string" ? `「${input.query}」` : "";
      return `${query} を検索しています...`;
    }
    case "Bash": {
      const desc = typeof input.description === "string" ? input.description : null;
      if (desc !== null) return desc;
      const cmd = typeof input.command === "string" ? input.command : "";
      if (cmd.includes("extract-video")) return "動画を要約しています。しばらくお待ちください...";
      return "コマンドを実行しています...";
    }
    case "TaskOutput":
      return "バックグラウンドタスクの完了を待っています...";
    case "Agent":
      return "サブエージェントに調査を依頼しています...";
    case "Glob":
      return "ファイルを検索しています...";
    case "WebFetch": {
      const url = typeof input.url === "string" ? input.url : "";
      return `${url} を取得しています...`;
    }
  }
  return null;
}

// allowedTools は canUseTool をスキップするため、onToolUse で安全チェックを行う
function createHandleToolUse(
  onEvent: (event: LoopEvent) => void,
): (toolName: string, input: Record<string, unknown>) => void {
  return (toolName, input) => {
    const activityMessage = describeToolActivity(toolName, input);
    if (activityMessage !== null) {
      console.log(`[coach] ${activityMessage}`);
      onEvent({ kind: "tool_activity", message: activityMessage });
    }

    switch (toolName) {
      case "Bash": {
        const command = input.command;
        if (typeof command !== "string" || !validateBashCommand(command).isValid) {
          throw new Error(`[coach] 不正なBashコマンドを検出。セッションを中断: ${command}`);
        }
        // extract-video は run_in_background で実行すべき。同期だと Bash の 10 分制約に引っかかる。
        // throw はしない（同期でも 3 定数 30 分化のフォールバックが効く可能性があるため）。
        const isExtractVideoCommand = command.includes("extract-video");
        const isSynchronousExecution = input.run_in_background !== true;
        if (isExtractVideoCommand && isSynchronousExecution) {
          console.warn(
            "[coach] 警告: extract-video.ts が同期実行されました。run_in_background: true を推奨します。",
          );
        }
        break;
      }
      case "Write": {
        const filePath = input.file_path;
        if (typeof filePath === "string") {
          const resolved = resolveSkillPath(filePath);
          const skillsRoot = resolve(SKILLS_ROOT);
          if (resolved !== skillsRoot && !resolved.startsWith(skillsRoot + sep)) {
            throw new Error(`[coach] skills/ 外への書き込みを検出。セッションを中断: ${filePath}`);
          }
        }
        break;
      }
    }
  };
}

export type { UserMessage };

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
  | {
      readonly kind: "plan_step_updated";
      readonly stepIndex: number;
      readonly newStatus: PlanStepStatus;
    }
  | { readonly kind: "tool_activity"; readonly message: string }
  | { readonly kind: "mode_changed"; readonly mode: LoopMode }
  | { readonly kind: "stopped" };

export type { LoopEvent, CoachAdvice };

type MessageBox = {
  readonly submit: (message: UserMessage) => void;
  readonly consume: () => UserMessage | null;
  readonly hasMessages: () => boolean;
  readonly awaitMessage: () => Promise<void>;
  readonly cancelAwait: () => void;
};

function createMessageBox(): MessageBox {
  const queue: UserMessage[] = [];
  let wakeResolve: (() => void) | null = null;

  return {
    submit: (message: UserMessage) => {
      queue.push(message);
      wakeResolve?.();
      wakeResolve = null;
    },
    consume: () => {
      return queue.shift() ?? null;
    },
    hasMessages: () => queue.length > 0,
    awaitMessage: () =>
      new Promise<void>((resolve) => {
        wakeResolve = resolve;
      }),
    cancelAwait: () => {
      wakeResolve = null;
    },
  };
}

// 「次へ進む」専用のチャンネル。messageBox とは別経路で、
// pending: boolean の単一フラグで連打 dedupe を型レベル保証する。
type NextRoundGate = {
  readonly request: () => void;
  readonly consumePending: () => boolean;
  readonly hasPending: () => boolean;
  readonly awaitRequest: (signal: AbortSignal) => Promise<void>;
  readonly cancelAwait: () => void;
};

function createNextRoundGate(): NextRoundGate {
  let pending = false;
  let wakeResolve: (() => void) | null = null;

  return {
    request: () => {
      if (pending) return;
      pending = true;
      wakeResolve?.();
      wakeResolve = null;
    },
    consumePending: () => {
      if (!pending) return false;
      pending = false;
      return true;
    },
    hasPending: () => pending,
    awaitRequest: (signal) =>
      new Promise<void>((resolve) => {
        if (pending || signal.aborted) {
          resolve();
          return;
        }
        wakeResolve = () => {
          resolve();
        };
      }),
    cancelAwait: () => {
      wakeResolve = null;
    },
  };
}

// auto/manual の切替と、auto モード中の timer wakeup を仲介するコントローラ。
// onChange を waitForNextRound の wake 要因に含めることで、
// auto → manual 切替時の race を防ぐ。
type ModeController = {
  readonly get: () => LoopMode;
  readonly set: (mode: LoopMode) => boolean;
  readonly onChange: (cb: () => void) => void;
  readonly offChange: () => void;
};

function createModeController(initial: LoopMode): ModeController {
  let current: LoopMode = initial;
  let changeCb: (() => void) | null = null;

  return {
    get: () => current,
    set: (mode) => {
      if (current === mode) return false;
      current = mode;
      changeCb?.();
      return true;
    },
    onChange: (cb) => {
      changeCb = cb;
    },
    offChange: () => {
      changeCb = null;
    },
  };
}

type CoachLoopOptions = {
  readonly config: CoachConfig;
  readonly signal: AbortSignal;
  readonly onEvent: (event: LoopEvent) => void;
  readonly displayId?: string;
  readonly referenceImages: readonly { readonly path: string; readonly label: string }[];
  readonly plan: Plan | null;
  readonly skillManifest: string | null;
  readonly previousAdvices: readonly RestoredAdvice[];
  readonly initialMode?: LoopMode;
};

type CoachLoopHandle = {
  readonly loopFinished: Promise<void>;
  readonly submitMessage: (message: UserMessage) => void;
  readonly getMode: () => LoopMode;
  readonly setMode: (mode: LoopMode) => void;
  readonly requestNextRound: () => void;
};

export type { CoachLoopOptions, CoachLoopHandle };

type LoopState = {
  readonly previousImage: CapturedImage | null;
  readonly sessionId: string | undefined;
  readonly roundIndex: number;
  readonly plan: Plan | null;
};

const SILENT_MARKER = "__SILENT__";

const SCREENSHOT_PATH = join(COACH_TEMP_DIR, "current.png");

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

// trigger ごとに diff チェックをスキップすべきか判定する
function shouldBypassDiffCheck(trigger: RoundTrigger): boolean {
  switch (trigger) {
    case "user_message":
    case "manual_next":
    case "initial":
      return true;
    case "timer":
      return false;
  }
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
    plan: current.plan,
  };
}

async function ensureTempDir(): Promise<void> {
  await mkdir(COACH_TEMP_DIR, { recursive: true });
}

async function saveScreenshot(pngBuffer: Buffer): Promise<string> {
  await writeFile(SCREENSHOT_PATH, pngBuffer);
  return SCREENSHOT_PATH;
}

async function cleanupTemp(): Promise<void> {
  // @throws — ファイルが存在しない場合のエラーは無視
  await unlink(SCREENSHOT_PATH).catch(() => {});
}

type WakeReason = "timer" | "abort" | "message" | "next_round" | "mode_changed";

// 次のラウンドまで待機する。auto モードでは timer/abort/message/next_round/mode_changed、
// manual モードでは timer 以外で wake する。
function waitForNextRound(
  intervalMs: number,
  signal: AbortSignal,
  messageBox: MessageBox,
  nextRoundGate: NextRoundGate,
  modeController: ModeController,
): Promise<WakeReason> {
  if (signal.aborted) return Promise.resolve("abort");
  if (messageBox.hasMessages()) return Promise.resolve("message");
  if (nextRoundGate.hasPending()) return Promise.resolve("next_round");

  return new Promise((resolve) => {
    let settled = false;

    const wakeUp = (reason: WakeReason) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(reason);
    };

    // manual モードでは timer を仕掛けない
    const timer =
      modeController.get() === "auto" ? setTimeout(() => wakeUp("timer"), intervalMs) : null;

    const onAbort = () => wakeUp("abort");
    signal.addEventListener("abort", onAbort, { once: true });

    messageBox.awaitMessage().then(() => wakeUp("message"));
    nextRoundGate.awaitRequest(signal).then(() => {
      if (nextRoundGate.hasPending()) wakeUp("next_round");
    });
    modeController.onChange(() => wakeUp("mode_changed"));

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      messageBox.cancelAwait();
      nextRoundGate.cancelAwait();
      modeController.offChange();
    };
  });
}

type RoundInput = {
  readonly trigger: RoundTrigger;
  readonly userMessage: UserMessage | null;
};

// 1ラウンド分の処理を実行し、次のラウンド用の LoopState を返す。
// 異常系は早期リターンで抜け、正常系だけが最後まで到達する構造。
//
//   ① ユーザーメッセージがあれば通知
//   ② 画面キャプチャ → 失敗なら return
//   ③ trigger に応じて diff 判定（manual_next/user_message/initial はスキップ）
//   ④ スクリーンショットを一時ファイルに保存
//   ⑤ AI に問い合わせ → エラーなら return
//   ⑥ セッション継続確認 → 途切れたら sessionId リセットして return
//   ⑦ 応答を解析し、advice or silent イベントを発火
async function executeOneRound(
  state: LoopState,
  options: CoachLoopOptions,
  input: RoundInput,
): Promise<LoopState> {
  const { config, onEvent } = options;

  if (input.trigger === "user_message" && input.userMessage !== null) {
    onEvent({ kind: "user_message_received", message: input.userMessage.text });
  }

  // @throws — OS レベルのキャプチャ失敗
  const captureResult = await captureScreen({
    maxWidthPx: config.maxImageWidthPx,
    displayId: options.displayId,
  });
  if (!captureResult.isOk) {
    onEvent({
      kind: "capture_failed",
      message: `[${captureResult.errorCode}] ${captureResult.message}`,
    });
    return { ...state, roundIndex: state.roundIndex + 1 };
  }

  const currentImage = captureResult.image;
  const shouldBypassDiff = shouldBypassDiffCheck(input.trigger);

  if (state.previousImage !== null && !shouldBypassDiff) {
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
    prompt: buildCoachUserPrompt({
      screenshotPath,
      isFirstRound,
      trigger: input.trigger,
      userMessage: input.userMessage,
      referenceImages: options.referenceImages,
      plan: state.plan,
    }),
    sessionId: state.sessionId,
    appendSystemPrompt: buildCoachSystemPrompt({
      referenceImages: options.referenceImages,
      plan: state.plan,
      skillManifest: options.skillManifest,
      previousAdvices: options.previousAdvices,
    }),
    agents: buildAgentDefinitions(),
    tools: ["Read", "Agent", "WebSearch", "WebFetch", "Write", "Bash", "Glob", "TaskOutput"],
    allowedTools: ["Read", "Agent", "Bash", "WebSearch", "Write", "TaskOutput"],
    canUseTool: createToolPermissionGuard(),
    onToolUse: createHandleToolUse(onEvent),
    maxTurns: ADVISOR_MAX_TURNS,
    timeoutMs: ADVISOR_TIMEOUT_MS,
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
      plan: state.plan,
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
  const nextRoundGate = createNextRoundGate();
  const modeController = createModeController(options.initialMode ?? "manual");

  let state: LoopState = {
    previousImage: null,
    sessionId: undefined,
    roundIndex: 0,
    plan: options.plan,
  };

  // 次に実行すべきラウンドの trigger を決定する。
  // null を返した場合はループ先頭に戻って再判定する（mode_changed や spurious wake のケース）。
  async function waitForNextTrigger(): Promise<RoundInput | null> {
    // 1) 保留中メッセージは常に最優先
    const queuedMessage = messageBox.consume();
    if (queuedMessage !== null) {
      return { trigger: "user_message", userMessage: queuedMessage };
    }

    // 2) 保留中の next_round 要求
    if (nextRoundGate.consumePending()) {
      return makeNextRoundTrigger();
    }

    // 3) 初回ラウンド: auto モードのみ即時実行、manual モードはゼロから待機
    if (state.previousImage === null && modeController.get() === "auto") {
      return { trigger: "initial", userMessage: null };
    }

    // 4) 待機
    const reason = await waitForNextRound(
      options.config.intervalSeconds * 1000,
      options.signal,
      messageBox,
      nextRoundGate,
      modeController,
    );

    switch (reason) {
      case "abort":
        return null;
      case "timer":
        return { trigger: "timer", userMessage: null };
      case "message": {
        const msg = messageBox.consume();
        if (msg === null) return null;
        return { trigger: "user_message", userMessage: msg };
      }
      case "next_round": {
        if (!nextRoundGate.consumePending()) return null;
        return makeNextRoundTrigger();
      }
      case "mode_changed":
        return null;
    }
  }

  function makeNextRoundTrigger(): RoundInput {
    // 初回ラウンドであっても trigger は manual_next のまま渡す。
    // 「初回キャプチャか」(state.previousImage === null) と「起動契機」(trigger) は
    // 直交した概念として扱い、prompts.ts 側で manual_next の初回ケースを別途扱う。
    return { trigger: "manual_next", userMessage: null };
  }

  const loopFinished = (async () => {
    await ensureTempDir();

    try {
      while (!options.signal.aborted) {
        const input = await waitForNextTrigger();
        if (options.signal.aborted) break;
        if (input === null) continue;

        state = await executeOneRound(state, options, input);
      }
    } finally {
      await cleanupTemp();
    }
  })();

  return {
    loopFinished,
    submitMessage: messageBox.submit,
    getMode: modeController.get,
    setMode: (mode) => {
      const changed = modeController.set(mode);
      if (!changed) return;
      options.onEvent({ kind: "mode_changed", mode });
      // manual → auto 遷移時は即時 1 ラウンド回す（UX 統一）
      if (mode === "auto") {
        nextRoundGate.request();
      }
    },
    requestNextRound: nextRoundGate.request,
  };
}
