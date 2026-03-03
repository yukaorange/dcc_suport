import {
  type AgentDefinition,
  query,
  type Options as SDKOptions,
} from "@anthropic-ai/claude-agent-sdk";

export type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

type EngineErrorCode = "TIMEOUT" | "SDK_ERROR" | "EMPTY_RESULT";

type EngineSuccess = {
  readonly isOk: true;
  readonly result: string;
  readonly sessionId: string | undefined;
  readonly rawMessages: readonly unknown[];
};

type EngineFailure = {
  readonly isOk: false;
  readonly errorCode: EngineErrorCode;
  readonly message: string;
};

export type EngineResult = EngineSuccess | EngineFailure;

type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";

const MAX_TIMEOUT_MS = 300_000;

export type InvokeClaudeOptions = {
  readonly prompt: string;
  readonly sessionId?: string;
  readonly appendSystemPrompt?: string;
  readonly agents?: Record<string, AgentDefinition>;
  readonly allowedTools?: readonly string[];
  readonly model?: string;
  readonly permissionMode?: PermissionMode;
  readonly maxTurns?: number;
  readonly timeoutMs?: number;
};

let activeQueryStartedAt: number | null = null;
let activeQueryTimeoutMs: number = 0;

// SDK は同時に複数の query を走らせると不安定になるため、簡易排他ロックで二重実行を防ぐ
function acquireQueryLock(timeoutMs: number): EngineFailure | number {
  if (activeQueryStartedAt !== null) {
    const staleLockThresholdMs = activeQueryTimeoutMs + 10_000;
    const elapsed = Date.now() - activeQueryStartedAt;
    if (elapsed < staleLockThresholdMs) {
      return {
        isOk: false,
        errorCode: "SDK_ERROR",
        message: `Previous query still running (elapsed: ${elapsed}ms). Skipped to prevent accumulation.`,
      };
    }
    console.warn(`WARNING: Stale query lock detected (${elapsed}ms). Allowing new query.`);
  }

  const startTime = Date.now();
  activeQueryStartedAt = startTime;
  activeQueryTimeoutMs = timeoutMs;
  return startTime; // クエリ開始時刻
}

function releaseQueryLock(startTime: number): void {
  if (activeQueryStartedAt === startTime) {
    activeQueryStartedAt = null;
  }
}

type MessageExtract = {
  readonly sessionId: string | undefined;
  readonly resultText: string | undefined;
};

function isTypedMessage(msg: unknown): msg is Record<string, unknown> & { type: string } {
  return typeof msg === "object" && msg !== null && "type" in msg;
}

function extractFromMessage(message: unknown): MessageExtract {
  if (!isTypedMessage(message)) return { sessionId: undefined, resultText: undefined };

  let sessionId: string | undefined;
  let resultText: string | undefined;

  if (
    message.type === "system" &&
    "subtype" in message &&
    message.subtype === "init" &&
    "session_id" in message
  ) {
    sessionId = message.session_id as string;
  }

  if (
    message.type === "result" &&
    "subtype" in message &&
    message.subtype === "success" &&
    "result" in message
  ) {
    resultText = message.result as string;
  }

  return { sessionId, resultText };
}

function buildQueryOptions(options: InvokeClaudeOptions): SDKOptions {
  const queryOptions: SDKOptions = {};

  if (options.sessionId) {
    queryOptions.resume = options.sessionId;
  }

  if (options.appendSystemPrompt) {
    queryOptions.systemPrompt = {
      type: "preset" as const,
      preset: "claude_code" as const,
      append: options.appendSystemPrompt,
    };
  }

  if (options.agents) {
    queryOptions.agents = options.agents;
  }

  if (options.allowedTools) {
    queryOptions.allowedTools = [...options.allowedTools];
  }

  if (options.model) {
    queryOptions.model = options.model;
  }

  if (options.permissionMode) {
    queryOptions.permissionMode = options.permissionMode;
    if (options.permissionMode === "bypassPermissions") {
      queryOptions.allowDangerouslySkipPermissions = true;
    }
  }

  if (options.maxTurns) {
    queryOptions.maxTurns = options.maxTurns;
  }

  return queryOptions;
}

export async function invokeClaude(options: InvokeClaudeOptions): Promise<EngineResult> {
  const timeoutMs = Math.min(options.timeoutMs ?? 60_000, MAX_TIMEOUT_MS);
  const queryOptions = buildQueryOptions(options);

  const queryStartTimeOrLockError = acquireQueryLock(timeoutMs);
  if (typeof queryStartTimeOrLockError !== "number") return queryStartTimeOrLockError;
  const myStartTime = queryStartTimeOrLockError;

  // SDK は AbortController による "stop and clean up" を保証しているため、ソフトタイムアウトのみで運用する
  // もし SDK が abort を無視するケースが観測された場合は、close() + Promise.race によるハードタイムアウトの導入を検討すること
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  // ストリーミングメッセージを逐次受信し、sessionId と最終結果テキストを抽出する
  const rawMessages: unknown[] = [];
  let sessionId: string | undefined;
  let resultText: string | undefined;

  try {
    // queryStream のデータフロー:
    //
    //   engine.ts          SDK (query)         claude CLI         Anthropic API
    //   ─────────          ───────────         ──────────         ─────────────
    //   for await ◄─ yield ◄─ for await ◄─ stdout ◄─── streaming response
    //       │                     │
    //       │  next()             │  next()
    //       ▼                     ▼
    //   message を処理      chunk を yield
    const queryStream = query({
      prompt: options.prompt,
      options: {
        ...queryOptions,
        abortController,
      },
    });

    for await (const message of queryStream) {
      rawMessages.push(message);
      const extracted = extractFromMessage(message);
      if (extracted.sessionId) sessionId = extracted.sessionId;
      if (extracted.resultText) resultText = extracted.resultText;
    }
  } catch (e) {
    clearTimeout(timer);

    if (abortController.signal.aborted) {
      return {
        isOk: false,
        errorCode: "TIMEOUT",
        message: `Query timed out after ${timeoutMs}ms`,
      };
    }

    return {
      isOk: false,
      errorCode: "SDK_ERROR",
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    releaseQueryLock(myStartTime);
  }

  clearTimeout(timer);

  if (resultText === undefined || resultText.trim().length === 0) {
    return {
      isOk: false,
      errorCode: "EMPTY_RESULT",
      message: "SDK returned no result",
    };
  }

  return {
    isOk: true,
    result: resultText,
    sessionId,
    rawMessages,
  };
}

type SessionCheckResult =
  | { readonly continuable: true }
  | { readonly continuable: false; readonly reason: string };

export function checkSessionContinuity(
  result: EngineResult,
  isFirstRound: boolean,
): SessionCheckResult {
  if (!result.isOk) {
    return { continuable: false, reason: result.message };
  }

  if (result.sessionId === undefined) {
    const context = isFirstRound
      ? "sessionId not available on first round. Session continuity is fundamentally broken."
      : "Session continuity lost: sessionId not returned by SDK";
    return { continuable: false, reason: context };
  }

  return { continuable: true };
}
