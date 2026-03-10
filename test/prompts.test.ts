import { describe, expect, test } from "vitest";
import type { Plan } from "../src/planner";
import { buildCoachSystemPrompt, buildCoachUserPrompt } from "../src/prompts";

const BASE_INPUT = {
	referenceImagePath: null,
	plan: null,
} as const;

describe("buildCoachUserPrompt", () => {
	test("初回ラウンドでメッセージなしの場合、観察を促すプロンプトが生成される", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: true,
			userMessage: null,
			...BASE_INPUT,
		});

		expect(result).toContain("最初のスクリーンショットです");
		expect(result).not.toContain("ユーザーからメッセージがあります");
		expect(result).not.toContain("前回から画面に変化がありました");
	});

	test("初回ラウンドでメッセージありの場合、観察プロンプトにメッセージが追記される", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: true,
			userMessage: "レイヤーの使い方を教えて",
			...BASE_INPUT,
		});

		expect(result).toContain("最初のスクリーンショットです");
		expect(result).toContain("レイヤーの使い方を教えて");
		expect(result).not.toContain("ユーザーからメッセージがあります");
		expect(result).not.toContain("前回から画面に変化がありました");
	});

	test("2回目以降でメッセージありの場合、メッセージ応答用プロンプトが生成される", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: false,
			userMessage: "色の調整方法は？",
			...BASE_INPUT,
		});

		expect(result).toContain("ユーザーからメッセージがあります");
		expect(result).toContain("色の調整方法は？");
		expect(result).not.toContain("最初のスクリーンショットです");
		expect(result).not.toContain("前回から画面に変化がありました");
	});

	test("2回目以降でメッセージなしの場合、画面変化通知プロンプトが生成される", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: false,
			userMessage: null,
			...BASE_INPUT,
		});

		expect(result).toContain("前回から画面に変化がありました");
		expect(result).not.toContain("最初のスクリーンショットです");
		expect(result).not.toContain("ユーザーからメッセージがあります");
	});

	test("全ケースでスクリーンショットパスがプロンプトに含まれる", () => {
		const path = "/custom/path/screenshot.png";

		const firstNoMsg = buildCoachUserPrompt({
			screenshotPath: path,
			isFirstRound: true,
			userMessage: null,
			...BASE_INPUT,
		});
		const firstWithMsg = buildCoachUserPrompt({
			screenshotPath: path,
			isFirstRound: true,
			userMessage: "test",
			...BASE_INPUT,
		});
		const laterWithMsg = buildCoachUserPrompt({
			screenshotPath: path,
			isFirstRound: false,
			userMessage: "test",
			...BASE_INPUT,
		});
		const laterNoMsg = buildCoachUserPrompt({
			screenshotPath: path,
			isFirstRound: false,
			userMessage: null,
			...BASE_INPUT,
		});

		expect(firstNoMsg).toContain(path);
		expect(firstWithMsg).toContain(path);
		expect(laterWithMsg).toContain(path);
		expect(laterNoMsg).toContain(path);
	});
});

const SAMPLE_PLAN: Plan = {
	goal: "ロゴデザイン",
	referenceSummary: "ミニマルなベクターロゴ",
	steps: [
		{ index: 1, application: "Illustrator", description: "ベース形状", status: "completed" },
		{ index: 2, application: "Photoshop", description: "テクスチャ加工", status: "in_progress" },
		{ index: 3, application: "After Effects", description: "エフェクト追加", status: "pending" },
	],
};

describe("buildCoachUserPrompt — リファレンス・プラン関連", () => {
	test("初回ラウンドでreferenceImagePath非nullの場合、ユーザープロンプトにリファレンスパスが含まれる", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: true,
			userMessage: null,
			referenceImagePath: "/tmp/ref.png",
			plan: null,
		});

		expect(result).toContain("/tmp/ref.png");
	});

	test("初回ラウンドでplan非nullの場合、ユーザープロンプトにプラン案内と指示が含まれる", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: true,
			userMessage: null,
			referenceImagePath: null,
			plan: SAMPLE_PLAN,
		});

		expect(result).toContain("制作プランが設定されています");
		expect(result).toContain("最初のステップに基づいてアドバイスの準備をしてください");
	});
});

describe("buildCoachSystemPrompt", () => {
	test("__SILENT__マーカーがシステムプロンプトに含まれる", () => {
		const result = buildCoachSystemPrompt({ referenceImagePath: null, plan: null });

		expect(result).toContain("__SILENT__");
	});

	test("referenceImagePath非nullでリファレンスセクションが含まれる", () => {
		const result = buildCoachSystemPrompt({ referenceImagePath: "/tmp/ref.png", plan: null });

		expect(result).toContain("リファレンス画像");
		expect(result).toContain("/tmp/ref.png");
	});

	test("plan非nullでプランセクションにgoal・referenceSummary・各ステップの実体が含まれる", () => {
		const result = buildCoachSystemPrompt({ referenceImagePath: null, plan: SAMPLE_PLAN });

		expect(result).toContain("制作プラン");
		expect(result).toContain("ロゴデザイン");
		expect(result).toContain("ミニマルなベクターロゴ");
		expect(result).toContain("[Illustrator] ベース形状");
		expect(result).toContain("[Photoshop] テクスチャ加工");
		expect(result).toContain("[After Effects] エフェクト追加");
	});

	test("プランのステップステータスが正しくマーク表示される", () => {
		const result = buildCoachSystemPrompt({ referenceImagePath: null, plan: SAMPLE_PLAN });

		expect(result).toContain("[完了]");
		expect(result).toContain("[作業中]");
		expect(result).toContain("[未着手]");
	});
});
