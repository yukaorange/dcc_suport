import sharp from "sharp";
import { invokeClaude } from "../engine";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "image file path";
const VERIFY_DIR = new URL("./tmp", import.meta.url).pathname;
const TEST_IMAGE_PATH = `${VERIFY_DIR}/dcc-verify-test.png`;
const COLOR_PATTERN = /赤|red|レッド/i;

export async function verifyImage(): Promise<VerifyResult> {
  const start = performance.now();

  await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toFile(TEST_IMAGE_PATH);

  const result = await invokeClaude({
    prompt: `この画像を見て、何色が見えるか1単語で答えてください: ${TEST_IMAGE_PATH}`,
    appendSystemPrompt: "画像ファイルのパスが提示されたら、その画像を確認して回答してください。",
    tools: [],
    timeoutMs: 60_000,
    maxTurns: 3,
  });

  const durationMs = performance.now() - start;

  if (!result.isOk) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `[${result.errorCode}] ${result.message}`,
      fallback: "base64エンコードでプロンプト埋め込み / テキスト説明に切替",
    };
  }

  if (!COLOR_PATTERN.test(result.result)) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `色の一致なし。応答: "${result.result.slice(0, 200)}"`,
      fallback: "base64エンコードでプロンプト埋め込み / テキスト説明に切替",
    };
  }

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `応答に色名を検出: "${result.result.slice(0, 100)}"`,
  };
}

if (import.meta.main) {
  const r = await verifyImage();
  printVerifyResult(r);
}
