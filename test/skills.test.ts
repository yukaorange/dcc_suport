import { describe, expect, test } from "vitest";
import { buildSkillManifest, createToolPermissionGuard, loadSkillManifest } from "../src/skills";

const GUARD_OPTIONS = { signal: new AbortController().signal, toolUseID: "test" };

describe("buildSkillManifest", () => {
	test("Photoshopを指定するとisOk:trueとmanifestが返る", async () => {
		const result = await buildSkillManifest({ applications: ["Photoshop"] });
		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.manifest.length).toBeGreaterThan(0);
	});

	test("manifestにはファイルパスが含まれる（中身ではない）", async () => {
		const result = await buildSkillManifest({ applications: ["Photoshop"] });
		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.manifest).toContain("skills/tools/photoshop/");
		expect(result.manifest).toContain(".md");
		expect(result.manifest).not.toContain("# Photoshop メニュー構造");
	});

	test("アプリ名は大文字小文字を問わず正規化される", async () => {
		const upper = await buildSkillManifest({ applications: ["PHOTOSHOP"] });
		const lower = await buildSkillManifest({ applications: ["photoshop"] });
		expect(upper.isOk).toBe(true);
		expect(lower.isOk).toBe(true);
		if (!upper.isOk || !lower.isOk) return;
		expect(upper.manifest).toBe(lower.manifest);
	});

	test("techniquesのファイルパスが含まれる", async () => {
		const result = await buildSkillManifest({ applications: ["Photoshop"] });
		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		expect(result.manifest).toContain("skills/techniques/");
	});

	test("スキルファイルが存在しないアプリでもtechniquesがあれば成功する", async () => {
		const result = await buildSkillManifest({ applications: ["UnknownApp"] });
		expect(result.isOk).toBe(true);
	});

	test("パストラバーサルを含むアプリ名は無視される", async () => {
		const result = await buildSkillManifest({ applications: ["../../etc"] });
		expect(result.isOk).toBe(true);
	});

	test("重複するアプリ名でもファイルパスは重複しない", async () => {
		const result = await buildSkillManifest({ applications: ["Photoshop", "photoshop", "PHOTOSHOP"] });
		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		const lines = result.manifest.split("\n");
		const uniqueLines = [...new Set(lines)];
		expect(lines.length).toBe(uniqueLines.length);
	});

	test("スペースを含むアプリ名はハイフンに正規化される", async () => {
		const withSpace = await buildSkillManifest({ applications: ["After Effects"] });
		const withHyphen = await buildSkillManifest({ applications: ["after-effects"] });

		expect(withSpace.isOk).toBe(true);
		expect(withHyphen.isOk).toBe(true);
		if (!withSpace.isOk || !withHyphen.isOk) return;
		expect(withSpace.manifest).toBe(withHyphen.manifest);
	});

	test("manifestの各行は '- ' で始まるパス形式である", async () => {
		const result = await buildSkillManifest({ applications: ["Photoshop"] });

		expect(result.isOk).toBe(true);
		if (!result.isOk) return;
		const lines = result.manifest.split("\n");
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line).toMatch(/^- .+\.md$/);
		}
	});
});

describe("createToolPermissionGuard", () => {
	test("skills/配下へのWriteはallowされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Write", { file_path: "skills/tools/photoshop/new.md" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("allow");
	});

	test("skills/外へのWriteはdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Write", { file_path: "src/index.ts" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("パストラバーサルを含むWriteはdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Write", { file_path: "skills/../src/index.ts" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("skills-evilのようなプレフィクス一致パスはdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Write", { file_path: "skills-evil/malicious.md" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("skills/配下のReadはallowされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Read", { file_path: "skills/techniques/masks.md" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("allow");
	});

	test("docs/配下のReadはallowされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Read", { file_path: "docs/README.md" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("allow");
	});

	test("skills/docs/外のReadはdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Read", { file_path: ".env" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("src/配下のReadはdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Read", { file_path: "src/index.ts" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("WebSearchはallowされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("WebSearch", { query: "photoshop tutorial" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("allow");
	});

	test("未知のツールはdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Edit", { file_path: "src/index.ts" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("extract-video.tsの正規実行はallowされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Bash", { command: "bun run src/extract-video.ts https://www.youtube.com/watch?v=abc123" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("allow");
	});

	test("任意のBashコマンドはdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Bash", { command: "rm -rf /" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("コマンドインジェクション(セミコロン)はdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Bash", { command: "bun run src/extract-video.ts https://youtube.com/watch?v=x; rm -rf /" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("不正なURL引数はdenyされる", async () => {
		const guard = createToolPermissionGuard();
		const result = await guard("Bash", { command: "bun run src/extract-video.ts https://example.com/malicious" }, GUARD_OPTIONS);
		expect(result.behavior).toBe("deny");
	});

	test("skills/配下のGlobはallowされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Glob", { path: "skills/tools/photoshop" }, GUARD_OPTIONS);

		expect(result.behavior).toBe("allow");
	});

	test("skills/外のGlobはdenyされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Glob", { path: "src" }, GUARD_OPTIONS);

		expect(result.behavior).toBe("deny");
	});

	test("WebFetchはallowされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("WebFetch", { url: "https://example.com" }, GUARD_OPTIONS);

		expect(result.behavior).toBe("allow");
	});

	test("Read: file_pathもpathも未指定の場合denyされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Read", {}, GUARD_OPTIONS);

		expect(result.behavior).toBe("deny");
	});

	test("Write: file_pathが未指定の場合denyされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Write", {}, GUARD_OPTIONS);

		expect(result.behavior).toBe("deny");
	});

	test("Bash: commandが未指定の場合denyされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Bash", {}, GUARD_OPTIONS);

		expect(result.behavior).toBe("deny");
	});

	test("URL引数なしでもコマンド構造が正しければallowされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Bash", { command: "bun run src/extract-video.ts" }, GUARD_OPTIONS);

		expect(result.behavior).toBe("allow");
	});

	test("改行文字を含むコマンドはdenyされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Bash", { command: "bun run src/extract-video.ts\nrm -rf /" }, GUARD_OPTIONS);

		expect(result.behavior).toBe("deny");
	});

	test("有効な動画ID文字列のみで構成されたURLはallowされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Bash", { command: "bun run src/extract-video.ts https://www.youtube.com/watch?v=abc123EXTRA" }, GUARD_OPTIONS);

		expect(result.behavior).toBe("allow");
	});

	test("YouTube URL末尾にスペースで追加ペイロードがある場合denyされる", async () => {
		const guard = createToolPermissionGuard();

		const result = await guard("Bash", { command: "bun run src/extract-video.ts https://www.youtube.com/watch?v=abc123 --dangerous-flag" }, GUARD_OPTIONS);

		expect(result.behavior).toBe("deny");
	});
});

describe("loadSkillManifest", () => {
	test("アプリ名の配列から目次を生成する", async () => {
		const manifest = await loadSkillManifest(["Photoshop"]);
		expect(manifest).not.toBeNull();
		expect(manifest).toContain("skills/tools/photoshop/");
	});

	test("空配列でもtechniques目次が返る", async () => {
		const manifest = await loadSkillManifest([]);
		expect(manifest).not.toBeNull();
	});
});
