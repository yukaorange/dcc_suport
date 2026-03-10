import { describe, expect, test, vi } from "vitest";
import { runSetupFlow } from "../src/setup-flow";

const { listDisplays } = vi.hoisted(() => ({
	listDisplays: vi.fn(),
}));

const { generatePlan } = vi.hoisted(() => ({
	generatePlan: vi.fn(),
}));

const inquirer = vi.hoisted(() => ({
	select: vi.fn(),
	input: vi.fn(),
	confirm: vi.fn(),
}));

vi.mock("../src/list-displays", () => ({ listDisplays }));
vi.mock("../src/planner", () => ({ generatePlan }));
vi.mock("@inquirer/prompts", () => inquirer);

describe("runSetupFlow", () => {
	test("プラン修正でcancelを入力するとUSER_CANCELLEDを返す", async () => {
		listDisplays.mockResolvedValue({
			isOk: true,
			displays: [{ id: "1", name: "Main" }],
		});
		inquirer.input
			.mockResolvedValueOnce("/tmp/ref.png")
			.mockResolvedValueOnce("ロゴを作りたい")
			.mockResolvedValueOnce("cancel");
		generatePlan.mockResolvedValue({
			isOk: true,
			plan: {
				goal: "テスト",
				referenceSummary: "テスト分析",
				steps: [{ index: 1, application: "Illustrator", description: "作業", status: "pending" }],
			},
		});
		inquirer.confirm.mockResolvedValueOnce(false);

		const result = await runSetupFlow(new AbortController().signal);

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("USER_CANCELLED");
	});
});
