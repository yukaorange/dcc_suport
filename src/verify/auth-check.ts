import { query } from "@anthropic-ai/claude-agent-sdk";

console.log("ANTHROPIC_API_KEY:", process.env.ANTHROPIC_API_KEY ? "SET" : "NOT SET");
console.log("Testing SDK with Claude Code subscription auth...\n");

try {
  for await (const message of query({
    prompt: "1+1は？数字だけ答えて",
    options: {
      maxTurns: 1,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      stderr: (data: string) => console.error("[stderr]", data),
    },
  })) {
    if (typeof message === "object" && message !== null && "type" in message) {
      const msg = message as Record<string, unknown>;
      switch (msg.type) {
        case "system":
          console.log(`[system] subtype=${msg.subtype}, session_id=${msg.session_id}`);
          break;
        case "result":
          console.log(`[result] subtype=${msg.subtype}, result=${msg.result}`);
          break;
        case "assistant":
          console.log(`[assistant] received`);
          break;
        default:
          console.log(`[${msg.type}]`);
      }
    }
  }
  console.log("\nSUCCESS: SDK works without API key (using Claude Code subscription)");
} catch (e) {
  console.error("\nFAILED:", e instanceof Error ? e.message : String(e));
}
