import pixelmatch from "pixelmatch";

// capture.ts の型に依存せず Uint8Array + プリミティブで受け取る（疎結合）
type DiffInput = {
  readonly currentPixels: Uint8Array;
  readonly currentWidthPx: number;
  readonly currentHeightPx: number;
  readonly previousPixels: Uint8Array;
  readonly previousWidthPx: number;
  readonly previousHeightPx: number;
  // pixelmatch の色差許容度（0.0-1.0）。config.diffThresholdPercent（画面全体の変化率閾値）とは別概念
  readonly pixelmatchThreshold: number;
};

// 比較成功時の結果。変化率・不一致数・総数の3値を返す
type DiffSuccess = {
  readonly isOk: true;
  readonly diffRatePercent: number;
  readonly mismatchedPixelCount: number;
  readonly totalPixelCount: number;
};

// DIMENSION_MISMATCH: current と previous の幅・高さが一致しない
// INVALID_BUFFER_SIZE: ピクセルバッファのバイト長が w × h × 4 と一致しない、またはサイズがゼロ
// INVALID_THRESHOLD: pixelmatchThreshold が 0.0-1.0 の範囲外
type DiffErrorCode = "DIMENSION_MISMATCH" | "INVALID_BUFFER_SIZE" | "INVALID_THRESHOLD";

// 比較失敗時の結果。エラーコードで原因を特定できる
type DiffFailure = {
  readonly isOk: false;
  readonly errorCode: DiffErrorCode;
  readonly message: string;
};

type DiffResult = DiffSuccess | DiffFailure;

export type { DiffResult };

// 2枚の RGBA ピクセルデータを比較し、画面の変化率(%)を算出する純粋関数。
// 比較自体は pixelmatch に委譲し、この関数は入力の検証と結果の整形を担う。
export function computeDiff(input: DiffInput): DiffResult {
  // threshold が範囲外だと pixelmatch の動作が不定になる
  if (
    !Number.isFinite(input.pixelmatchThreshold) ||
    input.pixelmatchThreshold < 0 ||
    input.pixelmatchThreshold > 1
  ) {
    return {
      isOk: false,
      errorCode: "INVALID_THRESHOLD",
      message: `pixelmatchThreshold must be between 0 and 1, got ${input.pixelmatchThreshold}`,
    };
  }

  // 0x0 だと変化率の除算で NaN になる
  if (input.currentWidthPx === 0 || input.currentHeightPx === 0) {
    return {
      isOk: false,
      errorCode: "INVALID_BUFFER_SIZE",
      message: "Width and height must be greater than 0",
    };
  }

  // サイズが異なる2枚は比較できない（例: 解像度変更直後）
  if (
    input.currentWidthPx !== input.previousWidthPx ||
    input.currentHeightPx !== input.previousHeightPx
  ) {
    return {
      isOk: false,
      errorCode: "DIMENSION_MISMATCH",
      message: `Dimensions differ: current=${input.currentWidthPx}x${input.currentHeightPx}, previous=${input.previousWidthPx}x${input.previousHeightPx}`,
    };
  }

  // pixelmatch は RGBA(4ch) を要求するため、期待バイト長は w × h × 4
  const expectedByteLength = input.currentWidthPx * input.currentHeightPx * 4;
  if (
    input.currentPixels.byteLength !== expectedByteLength ||
    input.previousPixels.byteLength !== expectedByteLength
  ) {
    return {
      isOk: false,
      errorCode: "INVALID_BUFFER_SIZE",
      message: `Buffer size mismatch: expected=${expectedByteLength}, current=${input.currentPixels.byteLength}, previous=${input.previousPixels.byteLength}`,
    };
  }

  const totalPixelCount = input.currentWidthPx * input.currentHeightPx;

  const mismatchedPixelCount = pixelmatch(
    input.previousPixels,
    input.currentPixels,
    undefined, // 差分ヒートマップ画像の出力は可視化不要
    input.currentWidthPx,
    input.currentHeightPx,
    { threshold: input.pixelmatchThreshold },
  );

  const diffRatePercent = (mismatchedPixelCount / totalPixelCount) * 100;

  return {
    isOk: true,
    diffRatePercent,
    mismatchedPixelCount,
    totalPixelCount,
  };
}
