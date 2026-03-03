import { writeFile } from "node:fs/promises";
import type { VerifyResult } from "./types";
import { verifyStreaming } from "./verify-streaming";
import { verifyImage } from "./verify-image";
import { verifySession } from "./verify-session";
import { verifyAgents } from "./verify-agents";
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
  const inconclusiveCount = results.filter(
    (r) => r.status === "inconclusive",
  ).length;

  const lines: string[] = [
    `# DCC-03 Verification Report`,
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

async function main(): Promise<void> {
  console.log("=== DCC-03 Verification ===\n");

  const allResults: VerifyResult[] = [];

  for (const verification of verifications) {
    console.log(`[${verification.label}]`);

    // @throws — SDK内部エラーが発生しうる
    try {
      const result = await verification.run();
      const results = Array.isArray(result) ? result : [result];
      allResults.push(...results);

      for (const r of results) {
        const icon = r.status === "pass" ? "+" : r.status === "fail" ? "x" : "?";
        console.log(`  [${icon}] ${r.name} (${Math.round(r.durationMs)}ms)`);
      }
    } catch (e) {
      const errorResult: VerifyResult = {
        status: "fail",
        name: verification.label,
        durationMs: 0,
        error: `Unexpected: ${e instanceof Error ? e.message : String(e)}`,
        fallback: "該当検証の個別実行で原因調査",
      };
      allResults.push(errorResult);
      console.log(`  [x] ${verification.label} — unexpected error`);
    }

    console.log("");
  }

  console.log("=== Results ===\n");

  const colWidths = { status: 13, name: 30, duration: 10 };
  const header = `${"Status".padEnd(colWidths.status)} ${"Name".padEnd(colWidths.name)} ${"Duration".padEnd(colWidths.duration)} Detail`;
  const separator = "-".repeat(header.length + 20);

  console.log(header);
  console.log(separator);

  for (const r of allResults) {
    const status = statusIcon(r.status).padEnd(colWidths.status);
    const name = r.name.padEnd(colWidths.name);
    const duration = `${Math.round(r.durationMs)}ms`.padEnd(colWidths.duration);
    switch (r.status) {
      case "pass":
        console.log(`${status} ${name} ${duration} ${r.detail.slice(0, 80)}`);
        break;
      case "fail":
        console.log(`${status} ${name} ${duration} ${r.error.slice(0, 80)}`);
        break;
      case "inconclusive":
        console.log(`${status} ${name} ${duration} ${r.reason.slice(0, 80)}`);
        break;
    }
  }

  console.log("");

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
