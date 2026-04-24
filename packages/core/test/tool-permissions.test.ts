import { describe, expect, it } from "vitest";
import {
  COACH_ALLOWED_TOOLS,
  COACH_TOOL_POLICIES,
  COACH_TOOLS,
  createToolPermissionGuard,
} from "../src/skills";

// このテストは「権限レジストリ (COACH_TOOL_POLICIES) が
// allowedTools / canUseTool の整合性を構造的に保証している」ことを固定する。
//
// かつて起きたバグ: Bash を allowedTools に入れたまま canUseTool にも deny ロジックを書いたため、
// allowedTools による canUseTool スキップで deny が silent bypass され、
// onToolUse の throw がセッションごと落とす事故につながった。
// レジストリは gated と auto-allow を同時に両立できない構造なので、
// そのクラスのバグが書けなくなる。

describe("COACH_TOOL_POLICIES レジストリ不変条件", () => {
  it("COACH_TOOLS はレジストリのキー集合と一致する", () => {
    expect([...COACH_TOOLS].sort()).toEqual(Object.keys(COACH_TOOL_POLICIES).sort());
  });

  it("COACH_ALLOWED_TOOLS は auto-allow のツールだけを含む", () => {
    const expected = Object.entries(COACH_TOOL_POLICIES)
      .filter(([, policy]) => policy.kind === "auto-allow")
      .map(([name]) => name);
    expect([...COACH_ALLOWED_TOOLS].sort()).toEqual(expected.sort());
  });

  it("gated なツールは COACH_ALLOWED_TOOLS に入っていない (silent bypass 防止)", () => {
    for (const [name, policy] of Object.entries(COACH_TOOL_POLICIES)) {
      if (policy.kind === "gated") {
        const reason = `${name} は gated なので allowedTools に入れてはいけない`;
        expect(COACH_ALLOWED_TOOLS, reason).not.toContain(name);
      }
    }
  });
});

describe("createToolPermissionGuard の判定", () => {
  const guard = createToolPermissionGuard();

  it("auto-allow ツールは canUseTool で常に allow を返す", async () => {
    const sampleInputs: Record<string, Record<string, unknown>> = {
      Agent: { description: "x", prompt: "y" },
      WebSearch: { query: "q" },
      WebFetch: { url: "https://example.com" },
      TaskOutput: {},
    };
    for (const name of COACH_ALLOWED_TOOLS) {
      const result = await guard(name, sampleInputs[name] ?? {});
      expect(result.behavior, `${name} は auto-allow のはず`).toBe("allow");
    }
  });

  it("Bash は extract-video 以外を deny する", async () => {
    const result = await guard("Bash", {
      command: "find /Users -type d -name skills",
    });
    expect(result.behavior).toBe("deny");
  });

  it("Bash は whitelist された extract-video 呼び出しを allow する", async () => {
    const result = await guard("Bash", {
      command: 'bun run packages/core/src/extract-video.ts "https://www.youtube.com/watch?v=abc"',
    });
    expect(result.behavior).toBe("allow");
  });

  it("Write は skills/ 外への書き込みを deny する", async () => {
    const result = await guard("Write", { file_path: "/tmp/attack.txt" });
    expect(result.behavior).toBe("deny");
  });

  it("Read は skills/ や docs/ 外の読み取りを deny する", async () => {
    const result = await guard("Read", { file_path: "/etc/passwd" });
    expect(result.behavior).toBe("deny");
  });

  it("Read は skills/ 配下の相対パスを allow する", async () => {
    const result = await guard("Read", { file_path: "skills/techniques/gradients.md" });
    expect(result.behavior).toBe("allow");
  });

  it("Glob も Read と同じパス制限で deny する", async () => {
    const result = await guard("Glob", { path: "/etc" });
    expect(result.behavior).toBe("deny");
  });

  it("未登録ツールは deny する", async () => {
    const result = await guard("SomethingNew", {});
    expect(result.behavior).toBe("deny");
  });
});
