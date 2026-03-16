import { describe, expect, test } from "vitest";
import { extractVideoContent } from "../src/gemini";

describe("extractVideoContent", () => {
	test("GEMINI_API_KEYが未設定の場合、NO_API_KEYエラーを返す", async () => {
		const originalKey = process.env.GEMINI_API_KEY;
		delete process.env.GEMINI_API_KEY;

		const result = await extractVideoContent("https://www.youtube.com/watch?v=test123");
		expect(result.isOk).toBe(false);
		if (!result.isOk) {
			expect(result.errorCode).toBe("NO_API_KEY");
		}

		if (originalKey) process.env.GEMINI_API_KEY = originalKey;
	});

	test("不正なURLの場合、INVALID_URLエラーを返す", async () => {
		process.env.GEMINI_API_KEY = "dummy-key";
		const result = await extractVideoContent("https://example.com/not-youtube");
		expect(result.isOk).toBe(false);
		if (!result.isOk) {
			expect(result.errorCode).toBe("INVALID_URL");
		}
		delete process.env.GEMINI_API_KEY;
	});
});
