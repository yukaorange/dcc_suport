import type { LoopEvent } from "./coach-loop";

const SEPARATOR = "─".repeat(50);
const DOUBLE_SEPARATOR = "═".repeat(50);

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
      console.log(`  [~] 変化なし: ${event.diffRatePercent}%`);
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
      console.log("  [~] アドバイスなし。静観します。");
      break;
    case "engine_error":
      console.log(`  [!] AI応答エラー: ${event.message}`);
      break;
    case "session_lost":
      console.log(`  [!] セッション途切れ: ${event.reason} → 新規セッションで継続`);
      break;
    case "plan_step_updated": {
      const label =
        event.newStatus === "completed"
          ? "完了"
          : event.newStatus === "in_progress"
            ? "→ 作業中"
            : "  未着手";
      console.log(`  [Plan] Step ${event.stepIndex}: ${label}`);
      break;
    }
    case "tool_activity":
      console.log(`  [tool] ${event.message}`);
      break;
    case "mode_changed":
      console.log(`  [mode] ${event.mode === "auto" ? "自動モード" : "手動モード"}に切替`);
      break;
    case "stopped":
      console.log(`\n${SEPARATOR}`);
      console.log("  DCC Coach - セッション終了");
      console.log(`${SEPARATOR}\n`);
      break;
  }
}

type SetupEvent =
  | { readonly kind: "setup_started" }
  | { readonly kind: "config_loaded"; readonly configPath: string }
  | { readonly kind: "config_not_found" }
  | { readonly kind: "config_error"; readonly message: string }
  | { readonly kind: "setup_complete"; readonly displayName: string }
  | { readonly kind: "setup_failed"; readonly message: string };

export type { SetupEvent };

export function printSetupEvent(event: SetupEvent): void {
  switch (event.kind) {
    case "setup_started":
      console.log(`\n${DOUBLE_SEPARATOR}`);
      console.log("  DCC Coach - セットアップ");
      console.log(`${DOUBLE_SEPARATOR}\n`);
      break;
    case "config_loaded":
      console.log(`  [OK] 設定ファイル読み込み: ${event.configPath}`);
      break;
    case "config_not_found":
      console.log("  [~] config.json が見つかりません。デフォルト設定を使用します。");
      break;
    case "config_error":
      console.log(`  [!] 設定エラー: ${event.message}`);
      break;
    case "setup_complete":
      console.log(`\n${SEPARATOR}`);
      console.log(`  監視対象: ${event.displayName}`);
      console.log("  作業を開始してください。コーチングループに入ります。");
      console.log(`${SEPARATOR}\n`);
      break;
    case "setup_failed":
      console.log(`\n  [!] セットアップ失敗: ${event.message}\n`);
      break;
  }
}
