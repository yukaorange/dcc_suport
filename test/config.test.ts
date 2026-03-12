import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config";

const TMP_DIR = join(import.meta.dirname, ".tmp-config-test");

beforeAll(async () => {
	await mkdir(TMP_DIR, { recursive: true });
});

afterAll(async () => {
	await rm(TMP_DIR, { recursive: true, force: true });
});

async function writeJson(name: string, content: string): Promise<string> {
	const path = join(TMP_DIR, name);
	await writeFile(path, content, "utf-8");
	return path;
}

describe("loadConfig", () => {
	test("有効なJSONファイルから部分設定をマージしたCoachConfigを返す", async () => {
		const path = await writeJson("partial.json", JSON.stringify({ interval: 10 }));

		const result = await loadConfig(path);

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.config.intervalSeconds).toBe(10);
		expect(result.config.diffThresholdPercent).toBe(5);
	});

	test("キーマッピングが正しく変換される（interval→intervalSeconds, threshold→diffThresholdPercent）", async () => {
		const path = await writeJson(
			"mapping.json",
			JSON.stringify({ interval: 30, threshold: 20 }),
		);

		const result = await loadConfig(path);

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.config.intervalSeconds).toBe(30);
		expect(result.config.diffThresholdPercent).toBe(20);
	});

	test("ネストされた設定（claude）がマージされる", async () => {
		const path = await writeJson(
			"nested.json",
			JSON.stringify({
				claude: { mcpConfig: "/tmp/mcp.json" },
			}),
		);

		const result = await loadConfig(path);

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.config.claude.mcpConfigPath).toBe("/tmp/mcp.json");
	});

	test("不正な型の値はデフォルト値にフォールバックする", async () => {
		const path = await writeJson(
			"invalid-types.json",
			JSON.stringify({ interval: "not-a-number", notification: 123 }),
		);

		const result = await loadConfig(path);

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.config.intervalSeconds).toBe(5);
		expect(result.config.notification).toBe("terminal");
	});

	test("ファイルが存在しない場合はFILE_NOT_FOUNDを返す", async () => {
		const result = await loadConfig(join(TMP_DIR, "nonexistent.json"));

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("FILE_NOT_FOUND");
	});

	test("不正なJSONの場合はPARSE_FAILEDを返す", async () => {
		const path = await writeJson("broken.json", "{invalid json}");

		const result = await loadConfig(path);

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("PARSE_FAILED");
	});

	test("ルートが配列の場合はPARSE_FAILEDを返す", async () => {
		const path = await writeJson("array.json", "[1, 2, 3]");

		const result = await loadConfig(path);

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("PARSE_FAILED");
	});

	test("intervalSecondsが範囲外の場合はVALIDATION_FAILEDを返す", async () => {
		const path = await writeJson("bad-interval.json", JSON.stringify({ interval: 999 }));

		const result = await loadConfig(path);

		expect(result.isOk).toBe(false);
		if (result.isOk) return;
		expect(result.errorCode).toBe("VALIDATION_FAILED");
		expect(result.message).toContain("intervalSeconds");
	});

});
