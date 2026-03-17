import screenshot from "screenshot-desktop";
import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";
import { buildCapturedImage, captureScreen } from "../src/index";

// テスト用の小さな PNG バッファを生成する
async function createTestPng(widthPx: number, heightPx: number): Promise<Buffer> {
  const rgbaPixels = Buffer.alloc(widthPx * heightPx * 4, 0);
  for (let i = 0; i < widthPx * heightPx; i++) {
    rgbaPixels[i * 4 + 3] = 255;
  }
  return sharp(rgbaPixels, { raw: { width: widthPx, height: heightPx, channels: 4 } })
    .png()
    .toBuffer();
}

vi.mock("screenshot-desktop", () => ({
  default: vi.fn(),
}));

describe("buildCapturedImage", () => {
  test("PNGバッファを変換するとCapturedImageを返す", async () => {
    const pngBuffer = await createTestPng(4, 4);

    const result = await buildCapturedImage(pngBuffer, 1280);

    expect(result.widthPx).toBe(4);
    expect(result.heightPx).toBe(4);
    expect(result.rawPixels).toBeInstanceOf(Uint8Array);
    expect(result.pngBuffer).toBeInstanceOf(Buffer);
    const meta = await sharp(result.pngBuffer).metadata();
    expect(meta.width).toBe(4);
    expect(meta.height).toBe(4);
  });

  test("maxWidthPxより小さい画像は拡大されない", async () => {
    const pngBuffer = await createTestPng(8, 6);

    const result = await buildCapturedImage(pngBuffer, 1280);

    expect(result.widthPx).toBe(8);
    expect(result.heightPx).toBe(6);
    const meta = await sharp(result.pngBuffer).metadata();
    expect(meta.width).toBe(8);
    expect(meta.height).toBe(6);
  });

  test("maxWidthPxより大きい画像は縮小されアスペクト比が維持される", async () => {
    const pngBuffer = await createTestPng(100, 50);

    const result = await buildCapturedImage(pngBuffer, 10);

    expect(result.widthPx).toBe(10);
    expect(result.heightPx).toBe(5);
    const meta = await sharp(result.pngBuffer).metadata();
    expect(meta.width).toBe(10);
    expect(meta.height).toBe(5);
  });

  test("RGBA 4チャンネルのピクセルデータを返す", async () => {
    const pngBuffer = await createTestPng(4, 4);

    const result = await buildCapturedImage(pngBuffer, 1280);

    expect(result.rawPixels.byteLength).toBe(result.widthPx * result.heightPx * 4);
  });
});

describe("captureScreen", () => {
  test("スクリーンショット取得に失敗するとSCREENSHOT_FAILEDを返す", async () => {
    vi.mocked(screenshot).mockRejectedValueOnce(new Error("no display"));

    const result = await captureScreen({ maxWidthPx: 1280 });

    expect(result.isOk).toBe(false);
    if (result.isOk) return;
    expect(result.errorCode).toBe("SCREENSHOT_FAILED");
    expect(result.message).toBe("no display");
  });

  test("不正なバッファを受け取るとRESIZE_FAILEDを返す", async () => {
    vi.mocked(screenshot).mockResolvedValueOnce(Buffer.from("not a png"));

    const result = await captureScreen({ maxWidthPx: 1280 });

    expect(result.isOk).toBe(false);
    if (result.isOk) return;
    expect(result.errorCode).toBe("RESIZE_FAILED");
  });

  test("数値文字列のdisplayIdはnumberに変換されてscreenshotに渡される", async () => {
    vi.mocked(screenshot).mockRejectedValueOnce(new Error("test"));

    await captureScreen({ maxWidthPx: 1280, displayId: "2" });

    expect(vi.mocked(screenshot)).toHaveBeenCalledWith({ format: "png", screen: 2 });
  });

  test("非数値文字列のdisplayIdはそのまま文字列でscreenshotに渡される", async () => {
    vi.mocked(screenshot).mockRejectedValueOnce(new Error("test"));

    await captureScreen({ maxWidthPx: 1280, displayId: "HDMI-1" });

    expect(vi.mocked(screenshot)).toHaveBeenCalledWith({ format: "png", screen: "HDMI-1" });
  });

  test("空文字列のdisplayIdは0に変換される", async () => {
    vi.mocked(screenshot).mockRejectedValueOnce(new Error("test"));

    await captureScreen({ maxWidthPx: 1280, displayId: "" });

    expect(vi.mocked(screenshot)).toHaveBeenCalledWith({ format: "png", screen: 0 });
  });

  test("displayId未指定時はscreenがundefinedで渡される", async () => {
    vi.mocked(screenshot).mockRejectedValueOnce(new Error("test"));

    await captureScreen({ maxWidthPx: 1280 });

    expect(vi.mocked(screenshot)).toHaveBeenCalledWith({ format: "png", screen: undefined });
  });
});
