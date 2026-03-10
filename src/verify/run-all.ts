import { writeFile } from "node:fs/promises";
import type { VerifyResult } from "./types";
import { verifyAgents } from "./verify-agents";
import { verifyCaptureDiff } from "./verify-capture-diff";
import { verifyImage } from "./verify-image";
import { verifySession } from "./verify-session";
import { verifyStreaming } from "./verify-streaming";
import { verifySystemPrompt } from "./verify-system-prompt";

type VerifyEntry = {
  readonly label: string;
  readonly run: () => Promise<VerifyResult | VerifyResult[]>;
};

const verifications: readonly VerifyEntry[] = [
  { label: "Streaming + Message Structure", run: verifyStreaming },
  { label: "Image File Path", run: verifyImage },
  { label: "Session Continuity", run: verifySession },
  { label: "Agents (Subagent)", run: verifyAgents },
  { label: "System Prompt Append", run: verifySystemPrompt },
  { label: "Capture + Diff", run: verifyCaptureDiff },
];

function statusIcon(status: string): string {
  switch (status) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "inconclusive":
      return "INCONCLUSIVE";
    default:
      return "???";
  }
}

function formatResultLine(r: VerifyResult): string {
  const duration = `${Math.round(r.durationMs)}ms`;
  switch (r.status) {
    case "pass":
      return `| ${statusIcon(r.status)} | ${r.name} | ${duration} | ${r.detail} |`;
    case "fail":
      return `| ${statusIcon(r.status)} | ${r.name} | ${duration} | ${r.error} |`;
    case "inconclusive":
      return `| ${statusIcon(r.status)} | ${r.name} | ${duration} | ${r.reason} |`;
  }
}

function generateReport(results: readonly VerifyResult[]): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const inconclusiveCount = results.filter((r) => r.status === "inconclusive").length;

  const lines: string[] = [
    `# DCC Support Verification Report`,
    ``,
    `Generated: ${now}`,
    ``,
    `## Summary`,
    ``,
    `- **PASS**: ${passCount}`,
    `- **FAIL**: ${failCount}`,
    `- **INCONCLUSIVE**: ${inconclusiveCount}`,
    `- **Total**: ${results.length}`,
    ``,
    `## Results`,
    ``,
    `| Status | Name | Duration | Detail |`,
    `|--------|------|----------|--------|`,
    ...results.map(formatResultLine),
    ``,
  ];

  const failures = results.filter((r) => r.status === "fail");
  if (failures.length > 0) {
    lines.push(`## Fallback Strategies`, ``);
    for (const f of failures) {
      if (f.status === "fail") {
        lines.push(`### ${f.name}`, ``, `- Error: ${f.error}`, `- Fallback: ${f.fallback}`, ``);
      }
    }
  }

  lines.push(
    `## Phase 2 以降への影響・推奨事項`,
    ``,
    `- ストリーミングが正常なら: engine.tsの現行設計を維持`,
    `- セッション継続が正常なら: resumeベースのコーチングループを採用`,
    `- agentsが正常なら: coach/researcherのサブエージェント構成を採用`,
    `- systemPrompt.appendが正常なら: スキルファイル注入をappendで実装`,
    `- AbortSignalが尊重されるなら: 現行のタイムアウト設計を維持`,
    `- AbortSignalが尊重されない場合: SDK採用を再検討（ブロッキング所見）`,
    ``,
  );

  return lines.join("\n");
}

function resultDetailText(r: VerifyResult): string {
  switch (r.status) {
    case "pass":
      return r.detail;
    case "fail":
      return r.error;
    case "inconclusive":
      return r.reason;
  }
}

function statusIconChar(status: VerifyResult["status"]): string {
  switch (status) {
    case "pass":
      return "+";
    case "fail":
      return "x";
    case "inconclusive":
      return "?";
  }
}

async function runVerification(entry: VerifyEntry): Promise<VerifyResult[]> {
  console.log(`[${entry.label}]`);

  // @throws — SDK内部エラーが発生しうる
  try {
    const result = await entry.run();
    const results = Array.isArray(result) ? result : [result];

    for (const r of results) {
      console.log(`  [${statusIconChar(r.status)}] ${r.name} (${Math.round(r.durationMs)}ms)`);
    }

    console.log("");
    return results;
  } catch (e) {
    const errorResult: VerifyResult = {
      status: "fail",
      name: entry.label,
      durationMs: 0,
      error: `Unexpected: ${e instanceof Error ? e.message : String(e)}`,
      fallback: "該当検証の個別実行で原因調査",
    };
    console.log(`  [x] ${entry.label} — unexpected error`);
    console.log("");
    return [errorResult];
  }
}

function printResultsTable(results: readonly VerifyResult[]): void {
  const colWidths = { status: 13, name: 30, duration: 10 };
  const header = `${"Status".padEnd(colWidths.status)} ${"Name".padEnd(colWidths.name)} ${"Duration".padEnd(colWidths.duration)} Detail`;
  const separator = "-".repeat(header.length + 20);

  console.log(header);
  console.log(separator);

  for (const r of results) {
    const status = statusIcon(r.status).padEnd(colWidths.status);
    const name = r.name.padEnd(colWidths.name);
    const duration = `${Math.round(r.durationMs)}ms`.padEnd(colWidths.duration);
    console.log(`${status} ${name} ${duration} ${resultDetailText(r).slice(0, 80)}`);
  }

  console.log("");
}

async function main(): Promise<void> {
  console.log("=== DCC-03 Verification ===\n");

  const allResults: VerifyResult[] = [];

  for (const verification of verifications) {
    const results = await runVerification(verification);
    allResults.push(...results);
  }

  console.log("=== Results ===\n");
  printResultsTable(allResults);

  const report = generateReport(allResults);
  await writeFile("verify-report.md", report, "utf-8");
  console.log("Report written to verify-report.md");

  const hasFailure = allResults.some((r) => r.status === "fail");
  const hasInconclusive = allResults.some((r) => r.status === "inconclusive");

  if (hasFailure || hasInconclusive) {
    process.exit(1);
  }
}

//コア機能検証
main();
