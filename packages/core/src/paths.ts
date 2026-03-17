import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SKILLS_ROOT = join(PACKAGE_ROOT, "skills");
export const COACH_TEMP_DIR = join(PACKAGE_ROOT, ".coach-tmp");
export const EXTRACT_VIDEO_SCRIPT = join(PACKAGE_ROOT, "src", "extract-video.ts");
