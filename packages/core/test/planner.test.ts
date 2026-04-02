import { describe, expect, test, vi } from "vitest";
import type { Plan } from "../src/index";
import { generatePlan, updateStepStatus } from "../src/index";

const SAMPLE_PLAN: Plan = {
  goal: "テスト用のゴール",
  referenceSummary: "テスト用の分析結果",
  steps: [
    { index: 1, application: "Illustrator", description: "ベクター作成", status: "completed" },
    { index: 2, application: "Photoshop", description: "テクスチャ加工", status: "pending" },
    { index: 3, application: "After Effects", description: "エフェクト追加", status: "pending" },
  ],
};

describe("updateStepStatus", () => {
  test("指定ステップのstatusが更新された新しいPlanを返す", () => {
    const updated = updateStepStatus(SAMPLE_PLAN, 2, "in_progress");

    const step2 = updated.steps.find((s) => s.index === 2);
    expect(step2?.status).toBe("in_progress");
  });

  test("他のステップのstatusは変更されない", () => {
    const updated = updateStepStatus(SAMPLE_PLAN, 2, "in_progress");

    expect(updated.steps.find((s) => s.index === 1)?.status).toBe("completed");
    expect(updated.steps.find((s) => s.index === 3)?.status).toBe("pending");
  });

  test("存在しないindexを指定すると元のPlanと同じ内容を返す", () => {
    const updated = updateStepStatus(SAMPLE_PLAN, 99, "completed");

    expect(updated.steps).toEqual(SAMPLE_PLAN.steps);
  });
});

const { invokeClaude } = vi.hoisted(() => ({
  invokeClaude: vi.fn(),
}));

vi.mock("../src/engine", () => ({
  invokeClaude,
}));

describe("generatePlan", () => {
  test("invokeClaudeが有効なプランJSONを返すとPlanオブジェクトを返す", async () => {
    const planJson = JSON.stringify({
      goal: "ロゴデザイン",
      referenceSummary: "ミニマルなベクターロゴ",
      steps: [
        { index: 1, application: "Illustrator", description: "ベース形状の作成" },
        { index: 2, application: "Photoshop", description: "テクスチャ追加" },
      ],
    });
    invokeClaude.mockResolvedValue({
      isOk: true,
      result: `\`\`\`json\n${planJson}\n\`\`\``,
      sessionId: "plan-session",
      rawMessages: [],
    });

    const result = await generatePlan({
      referenceImages: [{ path: "/tmp/ref.png", label: "" }],
      goalDescription: "ロゴを作りたい",
    });

    expect(result.isOk).toBe(true);
    if (!result.isOk) return;
    expect(result.plan.goal).toBe("ロゴデザイン");
    expect(result.plan.steps).toHaveLength(2);
    expect(result.plan.steps[0].status).toBe("pending");
  });
});
