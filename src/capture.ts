import screenshot from "screenshot-desktop";
import sharp from "sharp";

type CaptureConfig = {
  readonly maxWidthPx: number;
};

type CapturedImage = {
  readonly pngBuffer: Buffer;
  readonly rawPixels: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
};

type CaptureErrorCode = "SCREENSHOT_FAILED" | "RESIZE_FAILED";

type CaptureSuccess = {
  readonly isOk: true;
  readonly image: CapturedImage;
};

type CaptureFailure = {
  readonly isOk: false;
  readonly errorCode: CaptureErrorCode;
  readonly message: string;
};

type CaptureResult = CaptureSuccess | CaptureFailure;

export type { CaptureResult, CapturedImage };

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// functional core: Buffer → CapturedImage 変換（副作用なし）
export async function buildCapturedImage(
  pngBuffer: Buffer,
  maxWidthPx: number,
): Promise<CapturedImage> {
  const resized = sharp(pngBuffer)
    .resize({ width: maxWidthPx, withoutEnlargement: true })
    .ensureAlpha();

  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  const rawPixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

  const resizedPng = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return {
    pngBuffer: resizedPng,
    rawPixels,
    widthPx: info.width,
    heightPx: info.height,
  };
}

// mutable shell: 副作用（OS スクリーンショット）を Result 型に変換
export async function captureScreen(config: CaptureConfig): Promise<CaptureResult> {
  const screenshotBuffer = await screenshot({ format: "png" }).catch((e: unknown) => e);
  if (!(screenshotBuffer instanceof Buffer)) {
    return {
      isOk: false,
      errorCode: "SCREENSHOT_FAILED",
      message: toErrorMessage(screenshotBuffer),
    };
  }

  // sharp はデコード失敗やメモリ不足で例外をthrowするため、モジュール境界でResult型に変換する
  try {
    const image = await buildCapturedImage(screenshotBuffer, config.maxWidthPx);
    return { isOk: true, image };
  } catch (e) {
    return {
      isOk: false,
      errorCode: "RESIZE_FAILED",
      message: toErrorMessage(e),
    };
  }
}
