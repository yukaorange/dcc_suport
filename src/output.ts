import type { LoopEvent } from "./coach-loop";

const SEPARATOR = "─".repeat(50);

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString("ja-JP", { hour12: false });
}

export function printLoopEvent(event: LoopEvent): void {
  switch (event.kind) {
    case "started":
      console.log(`\n${SEPARATOR}`);
      console.log("  DCC Coach - セッション開始");
      console.log(`${SEPARATOR}\n`);
      break;
    case "capture_failed":
      console.log(`  [!] キャプチャ失敗: ${event.message}`);
      break;
    case "diff_skipped":
      console.log(`  [~] 差分スキップ: ${event.reason}`);
      break;
    case "no_change":
      break;
    case "user_message_received":
      console.log(`\n  [You] ${event.message}`);
      break;
    case "querying":
      console.log("  [?] AIに問い合わせ中...");
      break;
    case "advice": {
      const time = formatTimestamp(event.advice.timestampMs);
      console.log(`\n  [${time}] Coach:`);
      console.log(`  ${event.advice.content}`);
      console.log("");
      break;
    }
    case "silent":
      break;
    case "engine_error":
      console.log(`  [!] AI応答エラー: ${event.message}`);
      break;
    case "session_lost":
      console.log(`  [!] セッション途切れ: ${event.reason} → 新規セッションで継続`);
      break;
    case "stopped":
      console.log(`\n${SEPARATOR}`);
      console.log("  DCC Coach - セッション終了");
      console.log(`${SEPARATOR}\n`);
      break;
  }
}
