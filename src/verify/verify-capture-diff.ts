import sharp from "sharp";
import { captureScreen } from "../capture";
import { computeDiff } from "../diff";
import { printVerifyResult, type VerifyResult } from "./types";

async function verifyCaptureScreen(): Promise<VerifyResult> {
  const start = performance.now();
  const result = await captureScreen({ maxWidthPx: 1280 });
  const durationMs = performance.now() - start;

  if (!result.isOk) {
    return {
      status: "fail",
      name: "capture-screen",
      durationMs,
      error: `[${result.errorCode}] ${result.message}`,
      fallback: "macOS: システム環境設定 > プライバシー > 画面収録 でターミナルの権限を確認",
    };
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!result.image.pngBuffer.subarray(0, 8).equals(pngSignature)) {
    return {
      status: "fail",
      name: "capture-screen",
      durationMs,
      error: "Returned buffer is not a valid PNG",
      fallback: "screenshot-desktop の format 指定を確認",
    };
  }

  const expectedBytes = result.image.widthPx * result.image.heightPx * 4;
  if (result.image.rawPixels.byteLength !== expectedBytes) {
    return {
      status: "fail",
      name: "capture-screen",
      durationMs,
      error: `Raw pixel size mismatch: expected=${expectedBytes}, actual=${result.image.rawPixels.byteLength}`,
      fallback: "sharp の ensureAlpha() が正しく RGBA 4ch を出力しているか確認",
    };
  }

  return {
    status: "pass",
    name: "capture-screen",
    durationMs,
    detail: `PNG ${result.image.pngBuffer.byteLength} bytes, raw ${result.image.widthPx}x${result.image.heightPx}`,
  };
}

async function verifyDiffIdentical(): Promise<VerifyResult> {
  const start = performance.now();

  const { data, info } = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const result = computeDiff({
    currentPixels: pixels,
    currentWidthPx: info.width,
    currentHeightPx: info.height,
    previousPixels: pixels,
    previousWidthPx: info.width,
    previousHeightPx: info.height,
    pixelmatchThreshold: 0.1,
  });

  const durationMs = performance.now() - start;

  if (!result.isOk) {
    return {
      status: "fail",
      name: "diff-identical",
      durationMs,
      error: result.message,
      fallback: "computeDiff のガード節を確認",
    };
  }

  if (result.diffRatePercent !== 0) {
    return {
      status: "fail",
      name: "diff-identical",
      durationMs,
      error: `Expected 0%, got ${result.diffRatePercent}%`,
      fallback: "pixelmatch threshold を確認",
    };
  }

  return {
    status: "pass",
    name: "diff-identical",
    durationMs,
    detail: `diffRatePercent=${result.diffRatePercent}%`,
  };
}

async function verifyDiffDifferent(): Promise<VerifyResult> {
  const start = performance.now();

  const makePixels = async (r: number, g: number, b: number) => {
    const { data, info } = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r, g, b, alpha: 1 },
      },
    })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return {
      data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      widthPx: info.width,
      heightPx: info.height,
    };
  };

  const red = await makePixels(255, 0, 0);
  const blue = await makePixels(0, 0, 255);

  const result = computeDiff({
    currentPixels: blue.data,
    currentWidthPx: blue.widthPx,
    currentHeightPx: blue.heightPx,
    previousPixels: red.data,
    previousWidthPx: red.widthPx,
    previousHeightPx: red.heightPx,
    pixelmatchThreshold: 0.1,
  });

  const durationMs = performance.now() - start;

  if (!result.isOk) {
    return {
      status: "fail",
      name: "diff-different",
      durationMs,
      error: result.message,
      fallback: "computeDiff を確認",
    };
  }

  if (result.diffRatePercent <= 0) {
    return {
      status: "fail",
      name: "diff-different",
      durationMs,
      error: `Expected >0%, got ${result.diffRatePercent}%`,
      fallback: "pixelmatch の比較ロジックを確認",
    };
  }

  return {
    status: "pass",
    name: "diff-different",
    durationMs,
    detail: `diffRatePercent=${result.diffRatePercent.toFixed(1)}%, ${result.mismatchedPixelCount}/${result.totalPixelCount} pixels`,
  };
}

function verifyDiffDimensionMismatch(): VerifyResult {
  const start = performance.now();

  const result = computeDiff({
    currentPixels: new Uint8Array(100 * 100 * 4),
    currentWidthPx: 100,
    currentHeightPx: 100,
    previousPixels: new Uint8Array(200 * 200 * 4),
    previousWidthPx: 200,
    previousHeightPx: 200,
    pixelmatchThreshold: 0.1,
  });

  const durationMs = performance.now() - start;

  if (result.isOk) {
    return {
      status: "fail",
      name: "diff-dimension-mismatch",
      durationMs,
      error: "Expected failure, got success",
      fallback: "computeDiff のガード節を確認",
    };
  }

  if (result.errorCode !== "DIMENSION_MISMATCH") {
    return {
      status: "fail",
      name: "diff-dimension-mismatch",
      durationMs,
      error: `Expected DIMENSION_MISMATCH, got ${result.errorCode}`,
      fallback: "",
    };
  }

  return {
    status: "pass",
    name: "diff-dimension-mismatch",
    durationMs,
    detail: `Correctly detected: ${result.message}`,
  };
}

function verifyDiffInvalidBufferSize(): VerifyResult {
  const start = performance.now();

  const result = computeDiff({
    currentPixels: new Uint8Array(50 * 50 * 4),
    currentWidthPx: 100,
    currentHeightPx: 100,
    previousPixels: new Uint8Array(50 * 50 * 4),
    previousWidthPx: 100,
    previousHeightPx: 100,
    pixelmatchThreshold: 0.1,
  });

  const durationMs = performance.now() - start;

  if (result.isOk) {
    return {
      status: "fail",
      name: "diff-invalid-buffer-size",
      durationMs,
      error: "Expected failure, got success",
      fallback: "computeDiff のバイト長ガード節を確認",
    };
  }

  if (result.errorCode !== "INVALID_BUFFER_SIZE") {
    return {
      status: "fail",
      name: "diff-invalid-buffer-size",
      durationMs,
      error: `Expected INVALID_BUFFER_SIZE, got ${result.errorCode}`,
      fallback: "",
    };
  }

  return {
    status: "pass",
    name: "diff-invalid-buffer-size",
    durationMs,
    detail: `Correctly detected: ${result.message}`,
  };
}

export async function verifyCaptureDiff(): Promise<VerifyResult[]> {
  return [
    await verifyCaptureScreen(),
    await verifyDiffIdentical(),
    await verifyDiffDifferent(),
    verifyDiffDimensionMismatch(),
    verifyDiffInvalidBufferSize(),
  ];
}

if (import.meta.main) {
  const results = await verifyCaptureDiff();
  for (const r of results) {
    printVerifyResult(r);
  }
}
