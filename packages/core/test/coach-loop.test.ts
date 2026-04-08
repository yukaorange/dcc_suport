import { describe, expect, test, vi } from "vitest";
import type { LoopEvent, Plan } from "../src/index";
import { defaultConfig, startCoachLoop } from "../src/index";

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

vi.mock("../src/agents", () => ({
  buildAgentDefinitions: vi.fn().mockReturnValue({}),
}));

vi.mock("../src/skills", () => ({
  createToolPermissionGuard: vi.fn().mockReturnValue(async () => ({ behavior: "allow" })),
}));

const FAKE_IMAGE = {
  pngBuffer: Buffer.from("fake-png"),
  rawPixels: new Uint8Array(16),
  widthPx: 2,
  heightPx: 2,
};

function collectEvents(abortOn: LoopEvent["kind"]): {
  events: LoopEvent[];
  abortController: AbortController;
  onEvent: (e: LoopEvent) => void;
} {
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
    referenceImages: [],
    plan: null,
    skillManifest: null,
    previousAdvices: [],
    initialMode: "auto",
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
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "auto",
    });

    await loopFinished;

    expect(invokeClaude).toHaveBeenCalledWith(
      expect.objectContaining({ signal: abortController.signal }),
    );
  });

  test("referenceImagesとplanがinvokeClaudeのpromptとappendSystemPromptに反映される", async () => {
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
      referenceImages: [{ path: "/tmp/ref.png", label: "" }],
      plan,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "auto",
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

  test("skillManifestがinvokeClaudeのappendSystemPromptに反映される", async () => {
    invokeClaude.mockClear();

    captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
    invokeClaude.mockResolvedValue({
      isOk: true,
      result: "アドバイスです",
      sessionId: "skill-session",
      rawMessages: [],
    });
    checkSessionContinuity.mockReturnValue({ continuable: true });

    const { abortController, onEvent } = collectEvents("advice");

    const { loopFinished } = startCoachLoop({
      config: { ...defaultConfig, intervalSeconds: 0 },
      signal: abortController.signal,
      onEvent,
      referenceImages: [],
      plan: null,
      skillManifest: "- skills/techniques/masks.md\n- skills/tools/photoshop/shortcuts.md",
      previousAdvices: [],
      initialMode: "auto",
    });
    await loopFinished;

    const call = invokeClaude.mock.calls[0][0];
    expect(call.appendSystemPrompt).toContain("スキルファイル（操作リファレンス）");
    expect(call.appendSystemPrompt).toContain("skills/techniques/masks.md");
    expect(call.appendSystemPrompt).toContain("skills/tools/photoshop/shortcuts.md");
    expect(call.agents).toBeDefined();
    expect(call.tools).toContain("Agent");
    expect(call.canUseTool).toBeDefined();
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
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "auto",
    });

    await loopFinished;

    expect(events.some((e) => e.kind === "querying")).toBe(true);
    expect(events.every((e) => e.kind !== "engine_error")).toBe(true);
  });
});

describe("LoopMode", () => {
  test("manualモードでは初回ラウンドが自動実行されない", async () => {
    captureScreen.mockReset();
    invokeClaude.mockReset();
    captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
    invokeClaude.mockResolvedValue({
      isOk: true,
      result: "should not be called",
      sessionId: "x",
      rawMessages: [],
    });

    const abortController = new AbortController();
    const { loopFinished } = startCoachLoop({
      config: { ...defaultConfig, intervalSeconds: 0 },
      signal: abortController.signal,
      onEvent: () => {},
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "manual",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(captureScreen).not.toHaveBeenCalled();
    expect(invokeClaude).not.toHaveBeenCalled();
    abortController.abort();
    await loopFinished;
  });

  test("manualモードでrequestNextRound後に1ラウンド実行される", async () => {
    captureScreen.mockReset();
    invokeClaude.mockReset();
    captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
    invokeClaude.mockResolvedValue({
      isOk: true,
      result: "manual advice",
      sessionId: "x",
      rawMessages: [],
    });
    checkSessionContinuity.mockReturnValue({ continuable: true });

    const { events, abortController, onEvent } = collectEvents("advice");
    const handle = startCoachLoop({
      config: { ...defaultConfig, intervalSeconds: 0 },
      signal: abortController.signal,
      onEvent,
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "manual",
    });

    handle.requestNextRound();
    await handle.loopFinished;

    expect(invokeClaude).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.kind === "advice")).toBe(true);
  });

  test("requestNextRound連打でも1ラウンドしか実行されない", async () => {
    captureScreen.mockReset();
    invokeClaude.mockReset();
    captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
    let invokeCount = 0;
    invokeClaude.mockImplementation(async () => {
      invokeCount++;
      return {
        isOk: true,
        result: `round ${invokeCount}`,
        sessionId: "x",
        rawMessages: [],
      };
    });
    checkSessionContinuity.mockReturnValue({ continuable: true });

    const abortController = new AbortController();
    let adviceCount = 0;
    const handle = startCoachLoop({
      config: { ...defaultConfig, intervalSeconds: 0 },
      signal: abortController.signal,
      onEvent: (e) => {
        if (e.kind === "advice") {
          adviceCount++;
          if (adviceCount === 1) abortController.abort();
        }
      },
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "manual",
    });

    // 1 ラウンド完了前に 5 連打
    handle.requestNextRound();
    handle.requestNextRound();
    handle.requestNextRound();
    handle.requestNextRound();
    handle.requestNextRound();

    await handle.loopFinished;
    expect(invokeCount).toBe(1);
    expect(adviceCount).toBe(1);
  });

  test("auto→manual切替で進行中timerがキャンセルされる", async () => {
    captureScreen.mockReset();
    invokeClaude.mockReset();
    captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
    invokeClaude.mockResolvedValue({
      isOk: true,
      result: "advice",
      sessionId: "x",
      rawMessages: [],
    });
    checkSessionContinuity.mockReturnValue({ continuable: true });

    const abortController = new AbortController();
    const events: LoopEvent[] = [];
    let adviceCount = 0;

    const handle = startCoachLoop({
      // 長い interval で timer にピン留め
      config: { ...defaultConfig, intervalSeconds: 60 },
      signal: abortController.signal,
      onEvent: (e) => {
        events.push(e);
        if (e.kind === "advice") {
          adviceCount++;
          if (adviceCount === 1) {
            // 初回 advice 直後に manual に切替 → 以降は requestNextRound が無い限り次ラウンド無し
            handle.setMode("manual");
            setTimeout(() => abortController.abort(), 50);
          }
        }
      },
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "auto",
    });

    await handle.loopFinished;
    expect(invokeClaude).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.kind === "mode_changed" && e.mode === "manual")).toBe(true);
  });

  test("setModeは同じmodeを渡してもmode_changedを発火しない", async () => {
    const abortController = new AbortController();
    const events: LoopEvent[] = [];
    const handle = startCoachLoop({
      config: { ...defaultConfig, intervalSeconds: 60 },
      signal: abortController.signal,
      onEvent: (e) => events.push(e),
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "manual",
    });

    handle.setMode("manual");
    await new Promise((r) => setTimeout(r, 10));
    abortController.abort();
    await handle.loopFinished;

    expect(events.filter((e) => e.kind === "mode_changed")).toHaveLength(0);
  });

  test("autoモード2ラウンド目以降は画面差分が閾値未満ならinvokeClaudeをスキップする", async () => {
    captureScreen.mockReset();
    invokeClaude.mockReset();
    captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
    invokeClaude.mockResolvedValue({
      isOk: true,
      result: "first round advice",
      sessionId: "x",
      rawMessages: [],
    });
    checkSessionContinuity.mockReturnValue({ continuable: true });

    const events: LoopEvent[] = [];
    const abortController = new AbortController();
    let noChangeCount = 0;
    const handle = startCoachLoop({
      config: { ...defaultConfig, intervalSeconds: 0 },
      signal: abortController.signal,
      onEvent: (e) => {
        events.push(e);
        // 1 ラウンド目で advice が出た後、2 ラウンド目で no_change が出るのを待ってから abort
        if (e.kind === "no_change") {
          noChangeCount++;
          if (noChangeCount === 1) abortController.abort();
        }
      },
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "auto",
    });

    await handle.loopFinished;
    // 1 ラウンド目のみ invokeClaude が呼ばれ、2 ラウンド目以降は no_change でスキップされる
    expect(invokeClaude).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.kind === "advice")).toBe(true);
    expect(events.some((e) => e.kind === "no_change")).toBe(true);
  });

  test("manual→auto切替時はmode_changedの後に即時1ラウンド回る", async () => {
    captureScreen.mockReset();
    invokeClaude.mockReset();
    captureScreen.mockResolvedValue({ isOk: true, image: FAKE_IMAGE });
    invokeClaude.mockResolvedValue({
      isOk: true,
      result: "advice after auto",
      sessionId: "x",
      rawMessages: [],
    });
    checkSessionContinuity.mockReturnValue({ continuable: true });

    const events: LoopEvent[] = [];
    const abortController = new AbortController();
    let adviceCount = 0;
    const handle = startCoachLoop({
      // 60s interval だが、auto 切替時に nextRoundGate.request() が走るので
      // timer を待たず即時 1 ラウンド回るはず
      config: { ...defaultConfig, intervalSeconds: 60 },
      signal: abortController.signal,
      onEvent: (e) => {
        events.push(e);
        if (e.kind === "advice") {
          adviceCount++;
          if (adviceCount === 1) abortController.abort();
        }
      },
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
      initialMode: "manual",
    });

    // すぐに auto に切替 → 即時 1 ラウンド回る想定
    handle.setMode("auto");

    await handle.loopFinished;
    expect(adviceCount).toBe(1);
    const modeEvent = events.find((e) => e.kind === "mode_changed");
    expect(modeEvent).toEqual({ kind: "mode_changed", mode: "auto" });
  });
});
