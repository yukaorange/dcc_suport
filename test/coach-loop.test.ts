import { describe, expect, test, vi } from "vitest";
import type { LoopEvent } from "../src/coach-loop";
import { startCoachLoop } from "../src/coach-loop";
import { defaultConfig } from "../src/config";
import type { Plan } from "../src/planner";

const { captureScreen } = vi.hoisted(() => ({
	captureScreen: vi.fn(),
}));

const { invokeClaude, checkSessionContinuity } = vi.hoisted(() => ({
	invokeClaude: vi.fn(),
	checkSessionContinuity: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/capture", () => ({
	captureScreen,
}));

vi.mock("../src/engine", () => ({
	invokeClaude,
	checkSessionContinuity,
}));

const FAKE_IMAGE = {
	pngBuffer: Buffer.from("fake-png"),
	rawPixels: new Uint8Array(16),
	widthPx: 2,
	heightPx: 2,
};

function collectEvents(
	abortOn: LoopEvent["kind"],
): { events: LoopEvent[]; abortController: AbortController; onEvent: (e: LoopEvent) => void } {
	const abortController = new AbortController();
	const events: LoopEvent[] = [];

	const onEvent = (event: LoopEvent) => {
		events.push(event);
		if (event.kind === abortOn) {
			abortController.abort();
		}
	};

	return { events, abortController, onEvent };
}

function runLoop(abortController: AbortController, onEvent: (e: LoopEvent) => void) {
	return startCoachLoop({
		config: { ...defaultConfig, intervalSeconds: 0 },
		signal: abortController.signal,
		onEvent,
		referenceImagePath: null,
		plan: null,
	});
}

describe("startCoachLoop", () => {
	test("キャプチャ→AI応答→adviceイベントが発火し、abort後にloopFinishedが解決する", async () => {
		captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
		invokeClaude.mockResolvedValue({
			isOk: true,
			result: "レイヤーを整理するとよいでしょう。",
			sessionId: "test-session-id",
			rawMessages: [],
		});
		checkSessionContinuity.mockReturnValue({ continuable: true });

		const { events, abortController, onEvent } = collectEvents("advice");

		const { loopFinished } = runLoop(abortController, onEvent);
		await loopFinished;

		expect(events.some((e) => e.kind === "querying")).toBe(true);
		expect(events.some((e) => e.kind === "advice")).toBe(true);
		const adviceEvent = events.find((e) => e.kind === "advice");
		if (adviceEvent?.kind === "advice") {
			expect(adviceEvent.advice.content).toBe("レイヤーを整理するとよいでしょう。");
		}
	});

	test("キャプチャ失敗時にcapture_failedイベントが発火する", async () => {
		captureScreen.mockResolvedValue({
			isOk: false,
			errorCode: "SCREENSHOT_FAILED",
			message: "no display",
		});

		const { events, abortController, onEvent } = collectEvents("capture_failed");

		const { loopFinished } = runLoop(abortController, onEvent);
		await loopFinished;

		const failEvent = events.find((e) => e.kind === "capture_failed");
		expect(failEvent).toBeDefined();
		if (failEvent?.kind === "capture_failed") {
			expect(failEvent.message).toContain("SCREENSHOT_FAILED");
		}
	});

	test("AI応答エラー時にengine_errorイベントが発火する", async () => {
		captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
		invokeClaude.mockResolvedValue({
			isOk: false,
			errorCode: "TIMEOUT",
			message: "Query timed out",
		});

		const { events, abortController, onEvent } = collectEvents("engine_error");

		const { loopFinished } = runLoop(abortController, onEvent);
		await loopFinished;

		const errorEvent = events.find((e) => e.kind === "engine_error");
		expect(errorEvent).toBeDefined();
		if (errorEvent?.kind === "engine_error") {
			expect(errorEvent.message).toContain("TIMEOUT");
		}
	});

	test("AI応答が__SILENT__の場合にsilentイベントが発火する", async () => {
		captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
		invokeClaude.mockResolvedValue({
			isOk: true,
			result: "__SILENT__",
			sessionId: "test-session-id",
			rawMessages: [],
		});
		checkSessionContinuity.mockReturnValue({ continuable: true });

		const { events, abortController, onEvent } = collectEvents("silent");

		const { loopFinished } = runLoop(abortController, onEvent);
		await loopFinished;

		expect(events.some((e) => e.kind === "silent")).toBe(true);
		expect(events.every((e) => e.kind !== "advice")).toBe(true);
	});

	test("abort signalがinvokeClaudeに伝播される", async () => {
		const abortController = new AbortController();
		const events: LoopEvent[] = [];

		captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
		invokeClaude.mockImplementation(() => {
			abortController.abort();
			return Promise.resolve({
				isOk: false,
				errorCode: "ABORTED",
				message: "Query aborted by external signal",
			});
		});

		const { loopFinished } = startCoachLoop({
			config: { ...defaultConfig, intervalSeconds: 0 },
			signal: abortController.signal,
			onEvent: (e) => events.push(e),
			referenceImagePath: null,
			plan: null,
		});

		await loopFinished;

		expect(invokeClaude).toHaveBeenCalledWith(
			expect.objectContaining({ signal: abortController.signal }),
		);
	});

	test("referenceImagePathとplanがinvokeClaudeのpromptとappendSystemPromptに反映される", async () => {
		invokeClaude.mockClear();

		const plan: Plan = {
			goal: "テスト用ゴール",
			referenceSummary: "テスト分析結果",
			steps: [
				{ index: 1, application: "Illustrator", description: "ベクター作成", status: "pending" },
			],
		};

		captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
		invokeClaude.mockResolvedValue({
			isOk: true,
			result: "アドバイスです",
			sessionId: "ref-session",
			rawMessages: [],
		});
		checkSessionContinuity.mockReturnValue({ continuable: true });

		const { abortController, onEvent } = collectEvents("advice");

		const { loopFinished } = startCoachLoop({
			config: { ...defaultConfig, intervalSeconds: 0 },
			signal: abortController.signal,
			onEvent,
			referenceImagePath: "/tmp/ref.png",
			plan,
		});
		await loopFinished;

		const call = invokeClaude.mock.calls[0][0];
		expect(call.prompt).toContain("/tmp/ref.png");
		expect(call.prompt).toContain("制作プランが設定されています");
		expect(call.appendSystemPrompt).toContain("リファレンス画像");
		expect(call.appendSystemPrompt).toContain("/tmp/ref.png");
		expect(call.appendSystemPrompt).toContain("テスト用ゴール");
		expect(call.appendSystemPrompt).toContain("[Illustrator] ベクター作成");
	});

	test("ABORTED応答時はengine_errorイベントが発火しない", async () => {
		const abortController = new AbortController();
		const events: LoopEvent[] = [];

		captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
		invokeClaude.mockResolvedValue({
			isOk: false,
			errorCode: "ABORTED",
			message: "Query aborted by external signal",
		});

		const { loopFinished } = startCoachLoop({
			config: { ...defaultConfig, intervalSeconds: 0 },
			signal: abortController.signal,
			onEvent: (e) => {
				events.push(e);
				if (e.kind === "no_change") {
					abortController.abort();
				}
			},
			referenceImagePath: null,
			plan: null,
		});

		await loopFinished;

		expect(events.some((e) => e.kind === "querying")).toBe(true);
		expect(events.every((e) => e.kind !== "engine_error")).toBe(true);
	});
});
