import screenshot from "screenshot-desktop";
import sharp from "sharp";

type CaptureConfig = {
  readonly maxWidthPx: number;
  readonly displayId?: string;
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

// macOSでは数値ID、Linux/Windowsでは文字列ID（"HDMI-1"等）が使われるため、
// 数値に変換可能な場合のみ変換し、それ以外は文字列のまま渡す
function toScreenParam(displayId: string): number | string {
  const asNumber = Number(displayId);
  return Number.isNaN(asNumber) ? displayId : asNumber;
}

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

export async function captureScreen(config: CaptureConfig): Promise<CaptureResult> {
  const screen = config.displayId !== undefined ? toScreenParam(config.displayId) : undefined;
  const screenshotBuffer = await screenshot({ format: "png", screen }).catch((e: unknown) => e);
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
