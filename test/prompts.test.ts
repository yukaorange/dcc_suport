import { describe, expect, test } from "vitest";
import { buildCoachSystemPrompt, buildCoachUserPrompt } from "../src/prompts";

describe("buildCoachUserPrompt", () => {
	test("初回ラウンドでメッセージなしの場合、観察を促すプロンプトが生成される", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: true,
			userMessage: null,
		});

		expect(result).toContain("最初のスクリーンショットです");
		expect(result).toContain("観察してください");
		expect(result).not.toContain("ユーザーからメッセージがあります");
		expect(result).not.toContain("前回から画面に変化がありました");
	});

	test("初回ラウンドでメッセージありの場合、観察プロンプトにメッセージが追記される", () => {
		const result = buildCoachUserPrompt({
			screenshotPath: "/tmp/test.png",
			isFirstRound: true,
			userMessage: "レイヤーの使い方を教えて",
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
		});

		expect(result).toContain("前回から画面に変化がありました");
		expect(result).not.toContain("最初のスクリーンショットです");
		expect(result).not.toContain("ユーザーからメッセージがあります");
	});

	test("全ケースでスクリーンショットパスがプロンプトに含まれる", () => {
		const path = "/custom/path/screenshot.png";

		const firstNoMsg = buildCoachUserPrompt({ screenshotPath: path, isFirstRound: true, userMessage: null });
		const firstWithMsg = buildCoachUserPrompt({ screenshotPath: path, isFirstRound: true, userMessage: "test" });
		const laterWithMsg = buildCoachUserPrompt({ screenshotPath: path, isFirstRound: false, userMessage: "test" });
		const laterNoMsg = buildCoachUserPrompt({ screenshotPath: path, isFirstRound: false, userMessage: null });

		expect(firstNoMsg).toContain(path);
		expect(firstWithMsg).toContain(path);
		expect(laterWithMsg).toContain(path);
		expect(laterNoMsg).toContain(path);
	});
});

describe("buildCoachSystemPrompt", () => {
	test("__SILENT__マーカーがシステムプロンプトに含まれる", () => {
		const result = buildCoachSystemPrompt();

		expect(result).toContain("__SILENT__");
	});
});
