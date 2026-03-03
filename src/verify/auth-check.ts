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
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message
    ) {
      switch (message.type) {
        case "system":
          console.log(`[system] subtype=${(message as any).subtype}, session_id=${(message as any).session_id}`);
          break;
        case "result":
          console.log(`[result] subtype=${(message as any).subtype}, result=${(message as any).result}`);
          break;
        case "assistant":
          console.log(`[assistant] received`);
          break;
        default:
          console.log(`[${message.type}]`);
      }
    }
  }
  console.log("\nSUCCESS: SDK works without API key (using Claude Code subscription)");
} catch (e) {
  console.error("\nFAILED:", e instanceof Error ? e.message : String(e));
}
