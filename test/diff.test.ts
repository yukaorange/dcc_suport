import { describe, expect, test } from "vitest";
import { computeDiff } from "../src/diff";

// 指定サイズの RGBA バッファを単色で生成する
function createRgbaBuffer(widthPx: number, heightPx: number, rgba: [number, number, number, number]): Uint8Array {
	const buf = new Uint8Array(widthPx * heightPx * 4);
	for (let i = 0; i < widthPx * heightPx; i++) {
		buf[i * 4] = rgba[0];
		buf[i * 4 + 1] = rgba[1];
		buf[i * 4 + 2] = rgba[2];
		buf[i * 4 + 3] = rgba[3];
	}
	return buf;
}

const BLACK: [number, number, number, number] = [0, 0, 0, 255];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];

describe("computeDiff", () => {
	test("同一画像を比較すると変化率0%を返す", () => {
		const pixels = createRgbaBuffer(2, 2, BLACK);

		const result = computeDiff({
			currentPixels: pixels,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: pixels,
			previousWidthPx: 2,
			previousHeightPx: 2,
			pixelmatchThreshold: 0.1,
		});

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.diffRatePercent).toBe(0);
		expect(result.mismatchedPixelCount).toBe(0);
		expect(result.totalPixelCount).toBe(4);
	});

	test("全ピクセルが異なる画像を比較すると変化率100%を返す", () => {
		const current = createRgbaBuffer(2, 2, BLACK);
		const previous = createRgbaBuffer(2, 2, WHITE);

		const result = computeDiff({
			currentPixels: current,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: previous,
			previousWidthPx: 2,
			previousHeightPx: 2,
			pixelmatchThreshold: 0.1,
		});

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.diffRatePercent).toBe(100);
		expect(result.mismatchedPixelCount).toBe(4);
	});

	test("2x2画像の1ピクセルが異なると変化率25%を返す", () => {
		const current = createRgbaBuffer(2, 2, BLACK);
		const previous = createRgbaBuffer(2, 2, BLACK);
		// 左上1ピクセルだけ白に変更
		previous[0] = 255;
		previous[1] = 255;
		previous[2] = 255;

		const result = computeDiff({
			currentPixels: current,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: previous,
			previousWidthPx: 2,
			previousHeightPx: 2,
			pixelmatchThreshold: 0.1,
		});

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.diffRatePercent).toBe(25);
		expect(result.mismatchedPixelCount).toBe(1);
	});

	test("thresholdが範囲外だとINVALID_THRESHOLDを返す", () => {
		const pixels = createRgbaBuffer(2, 2, BLACK);

		const result = computeDiff({
			currentPixels: pixels,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: pixels,
			previousWidthPx: 2,
			previousHeightPx: 2,
			pixelmatchThreshold: 1.5,
		});

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("INVALID_THRESHOLD");
	});

	test("thresholdがNaNだとINVALID_THRESHOLDを返す", () => {
		const pixels = createRgbaBuffer(2, 2, BLACK);

		const result = computeDiff({
			currentPixels: pixels,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: pixels,
			previousWidthPx: 2,
			previousHeightPx: 2,
			pixelmatchThreshold: Number.NaN,
		});

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("INVALID_THRESHOLD");
	});

	test("thresholdがInfinityだとINVALID_THRESHOLDを返す", () => {
		const pixels = createRgbaBuffer(2, 2, BLACK);

		const result = computeDiff({
			currentPixels: pixels,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: pixels,
			previousWidthPx: 2,
			previousHeightPx: 2,
			pixelmatchThreshold: Number.POSITIVE_INFINITY,
		});

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("INVALID_THRESHOLD");
	});

	test("サイズ0の画像はINVALID_BUFFER_SIZEを返す", () => {
		const result = computeDiff({
			currentPixels: new Uint8Array(0),
			currentWidthPx: 0,
			currentHeightPx: 0,
			previousPixels: new Uint8Array(0),
			previousWidthPx: 0,
			previousHeightPx: 0,
			pixelmatchThreshold: 0.1,
		});

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("INVALID_BUFFER_SIZE");
	});

	test("幅・高さが異なる画像はDIMENSION_MISMATCHを返す", () => {
		const current = createRgbaBuffer(2, 2, BLACK);
		const previous = createRgbaBuffer(3, 3, BLACK);

		const result = computeDiff({
			currentPixels: current,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: previous,
			previousWidthPx: 3,
			previousHeightPx: 3,
			pixelmatchThreshold: 0.1,
		});

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("DIMENSION_MISMATCH");
	});

	test("バッファ長がw×h×4と一致しないとINVALID_BUFFER_SIZEを返す", () => {
		const validBuffer = createRgbaBuffer(2, 2, BLACK);
		const shortBuffer = new Uint8Array(8);

		const result = computeDiff({
			currentPixels: validBuffer,
			currentWidthPx: 2,
			currentHeightPx: 2,
			previousPixels: shortBuffer,
			previousWidthPx: 2,
			previousHeightPx: 2,
			pixelmatchThreshold: 0.1,
		});

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("INVALID_BUFFER_SIZE");
	});
});
