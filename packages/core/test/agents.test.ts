import { describe, expect, test } from "vitest";
import { buildAgentDefinitions } from "../src/index";

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

  test("researcherにはRead, Write, Globのみが設定される（WebSearch/WebFetch/Bashは含まない）", () => {
    const { researcher } = buildAgentDefinitions();
    expect(researcher.tools).toContain("Read");
    expect(researcher.tools).toContain("Write");
    expect(researcher.tools).toContain("Glob");
    expect(researcher.tools).not.toContain("WebSearch");
    expect(researcher.tools).not.toContain("WebFetch");
    expect(researcher.tools).not.toContain("Bash");
  });
});
