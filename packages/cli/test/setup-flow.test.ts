import { describe, expect, test, vi } from "vitest";
import type { SetupFlowDeps } from "../src/setup-flow";
import { runSetupFlow } from "../src/setup-flow";

function createMockDeps(): SetupFlowDeps {
  return {
    listDisplays: vi.fn(),
    generatePlan: vi.fn(),
    select: vi.fn(),
    input: vi.fn(),
    confirm: vi.fn(),
  };
}

describe("runSetupFlow", () => {
  test("プラン修正でcancelを入力するとUSER_CANCELLEDを返す", async () => {
    const deps = createMockDeps();

    vi.mocked(deps.listDisplays).mockResolvedValue({
      isOk: true,
      displays: [{ id: "1", name: "Main" }],
    });
    vi.mocked(deps.input)
      .mockResolvedValueOnce("/tmp/ref.png")
      .mockResolvedValueOnce("ロゴを作りたい")
      .mockResolvedValueOnce("cancel");
    vi.mocked(deps.generatePlan).mockResolvedValue({
      isOk: true,
      plan: {
        goal: "テスト",
        referenceSummary: "テスト分析",
        steps: [{ index: 1, application: "Illustrator", description: "作業", status: "pending" }],
      },
    });
    vi.mocked(deps.confirm).mockResolvedValueOnce(false);

    const result = await runSetupFlow(new AbortController().signal, deps);

    expect(result.isOk).toBe(false);
    if (result.isOk) return;
    expect(result.errorCode).toBe("USER_CANCELLED");
  });
});
