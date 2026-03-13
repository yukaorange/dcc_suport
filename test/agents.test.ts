import { describe, expect, test } from "vitest";
import { buildAgentDefinitions } from "../src/agents";

describe("buildAgentDefinitions", () => {
	test("advisorとresearcherの2エージェントが定義される", () => {
		const agents = buildAgentDefinitions();
		expect(agents).toHaveProperty("advisor");
		expect(agents).toHaveProperty("researcher");
	});

	test("advisorにはdescriptionとpromptが設定される", () => {
		const { advisor } = buildAgentDefinitions();
		expect(advisor.description.length).toBeGreaterThan(0);
		expect(advisor.prompt.length).toBeGreaterThan(0);
	});

	test("researcherにはWebSearch, Read, Write, Bash, Globを含むツールが設定される", () => {
		const { researcher } = buildAgentDefinitions();
		expect(researcher.tools).toContain("WebSearch");
		expect(researcher.tools).toContain("WebFetch");
		expect(researcher.tools).toContain("Read");
		expect(researcher.tools).toContain("Write");
		expect(researcher.tools).toContain("Bash");
		expect(researcher.tools).toContain("Glob");
	});

	test("副作用なし: 毎回同じ構造を返す", () => {
		const first = buildAgentDefinitions();
		const second = buildAgentDefinitions();
		expect(first.advisor.prompt).toBe(second.advisor.prompt);
		expect(first.researcher.tools).toEqual(second.researcher.tools);
	});
});
