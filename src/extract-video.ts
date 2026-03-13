import { extractVideoContent } from "./gemini";

const url = process.argv[2];

if (!url) {
  console.error("Usage: bun run src/extract-video.ts <youtube-url>");
  process.exit(1);
}

const result = await extractVideoContent(url);

if (!result.isOk) {
  console.error(`Error: ${result.message}`);
  process.exit(1);
}

console.log(result.content);
