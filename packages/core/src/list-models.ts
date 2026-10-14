import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

type ModelChoice = {
  readonly value: string;
  readonly displayName: string;
  readonly description: string;
  // value がエイリアス（"default", "opus" 等）の場合に実際に解決されるモデルID。
  // 「デフォルト」が何のモデルなのかを UI に表示するために使う
  readonly resolvedModel: string;
  readonly supportsEffort: boolean;
};

type ListModelsSuccess = { readonly isOk: true; readonly models: readonly ModelChoice[] };
type ListModelsFailure = { readonly isOk: false; readonly message: string };
type ListModelsResult = ListModelsSuccess | ListModelsFailure;

export type { ListModelsResult, ModelChoice };

const LIST_MODELS_TIMEOUT_MS = 30_000;

// supportedModels() は streaming input モードの query でのみ使える control request のため、
// プロンプトを一切送らない「開きっぱなしの空ストリーム」で query を立ち上げて一覧だけ取得する。
function createIdlePromptStream(signal: AbortSignal): AsyncGenerator<SDKUserMessage> {
  return (async function* () {
    await new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
  })() as AsyncGenerator<SDKUserMessage>;
}

export async function listAvailableModels(): Promise<ListModelsResult> {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), LIST_MODELS_TIMEOUT_MS);

  try {
    const q = query({
      prompt: createIdlePromptStream(abortController.signal),
      options: { abortController, maxTurns: 1 },
    });

    // メッセージストリームを消費しないと SDK 内部で control response の処理が進まず
    // "Query closed before response received" で落ちるため、読み捨てリーダーを回しておく
    (async () => {
      try {
        for await (const _message of q) {
          // 一覧取得に本文メッセージは不要。ストリームを流すためだけに消費する
        }
      } catch {
        // abort による打ち切りは正常系なので握りつぶす
      }
    })();

    const models = await q.supportedModels();

    return {
      isOk: true,
      models: models.map((m) => ({
        value: m.value,
        displayName: m.displayName,
        description: m.description,
        resolvedModel: m.resolvedModel ?? m.value,
        supportsEffort: m.supportsEffort === true,
      })),
    };
  } catch (e) {
    const reason = abortController.signal.aborted
      ? `モデル一覧の取得が ${LIST_MODELS_TIMEOUT_MS}ms でタイムアウトしました`
      : e instanceof Error
        ? e.message
        : String(e);
    return { isOk: false, message: reason };
  } finally {
    clearTimeout(timer);
    // 一覧取得が終わったら query を閉じる（プロンプトストリームも abort で解放される）
    abortController.abort();
  }
}
