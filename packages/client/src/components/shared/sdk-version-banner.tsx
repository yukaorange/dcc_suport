import { trpc } from "../../trpc";

// Agent SDK が最新でない場合にのみ表示される警告バナー。
// 古いSDKだと新しいモデルが選択肢に出ない等の実害があるため、全ページ共通で出す
export function SdkVersionBanner() {
  const { data } = trpc.system.sdkVersion.useQuery(undefined, {
    // 起動時に一度チェックした結果をサーバーが返すだけなので、再取得は不要
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });

  if (data === undefined || data.kind !== "outdated") return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-sm text-amber-900">
      ⚠️ Agent SDK が最新ではありません（v{data.installed} → v{data.latest}
      ）。新しいモデルが選択肢に出ない場合があります。
      <code className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs">
        {"cd packages/core && bun add @anthropic-ai/claude-agent-sdk@latest"}
      </code>
    </div>
  );
}
