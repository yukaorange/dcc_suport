import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { YOUTUBE_URL_PATTERN } from "./gemini";

const SKILLS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
const TECHNIQUES_DIR = join(SKILLS_ROOT, "techniques");

type SkillManifestInput = {
  readonly applications: readonly string[];
};

type SkillManifestResult =
  | { readonly isOk: true; readonly manifest: string }
  | { readonly isOk: false; readonly errorCode: "NO_SKILLS_FOUND"; readonly message: string };

export type { SkillManifestInput, SkillManifestResult };

const DIRECTORY_ALIAS: Record<string, string> = {
  "after-effects": "aftereffects",
  "after effects": "aftereffects",
};

const SAFE_APP_NAME_PATTERN = /^[a-z0-9-]+$/;

function normalizeApplicationName(name: string): string | null {
  const normalized = name.toLowerCase().replace(/\s+/g, "-");
  if (!SAFE_APP_NAME_PATTERN.test(normalized)) return null;
  return normalized;
}

function resolveToolsDirectory(application: string): string | null {
  const normalized = normalizeApplicationName(application);
  if (normalized === null) return null;
  return DIRECTORY_ALIAS[normalized] ?? normalized;
}

async function listMarkdownFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => null);
  if (entries === null) return [];

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(dirPath, entry.name))
    .sort();
}

function formatManifest(filePaths: readonly string[]): string {
  return filePaths.map((filePath) => `- ${relative(process.cwd(), filePath)}`).join("\n");
}

export async function buildSkillManifest(input: SkillManifestInput): Promise<SkillManifestResult> {
  const techniquePaths = await listMarkdownFiles(TECHNIQUES_DIR);

  const normalizedApps = input.applications
    .map(normalizeApplicationName)
    .filter((name): name is string => name !== null);
  const uniqueApps = [...new Set(normalizedApps)];

  const toolPathArrays = await Promise.all(
    uniqueApps.map(async (app) => {
      const dirName = resolveToolsDirectory(app);
      if (dirName === null) return [];
      return listMarkdownFiles(join(SKILLS_ROOT, "tools", dirName));
    }),
  );

  const allPaths = [...techniquePaths, ...toolPathArrays.flat()];

  if (allPaths.length === 0) {
    return {
      isOk: false,
      errorCode: "NO_SKILLS_FOUND",
      message: `対応するスキルファイルが見つかりませんでした: ${input.applications.join(", ")}`,
    };
  }

  return { isOk: true, manifest: formatManifest(allPaths) };
}

export async function loadSkillManifest(applications: readonly string[]): Promise<string | null> {
  const result = await buildSkillManifest({ applications });
  console.log(`スキルマニフェスト:\n${result.isOk ? result.manifest : "null"}`);

  return result.isOk ? result.manifest : null;
}

const PROJECT_ROOT = resolve(SKILLS_ROOT, "..");
const EXTRACT_VIDEO_SCRIPT = resolve(PROJECT_ROOT, "src", "extract-video.ts");
const SHELL_META_CHARS = /[;|&`$(){}!<>\n\r\t]/;

const ALLOWED_READ_ROOTS = [resolve(PROJECT_ROOT, "skills"), resolve(PROJECT_ROOT, "docs")];

function validateBashCommand(
  command: string,
): { isValid: true } | { isValid: false; reason: string } {
  if (SHELL_META_CHARS.test(command)) {
    return { isValid: false, reason: "Shell meta characters are not allowed" };
  }

  const parts = command.trim().split(/\s+/);
  if (parts.length < 3 || parts.length > 4) {
    return { isValid: false, reason: "Expected: bun run <script> [<youtube-url>]" };
  }

  const [runner, runCmd, scriptPath, url] = parts;
  if (runner !== "bun" || runCmd !== "run") {
    return { isValid: false, reason: "Only 'bun run' commands are allowed" };
  }

  const resolvedScript = resolve(scriptPath);
  if (resolvedScript !== EXTRACT_VIDEO_SCRIPT) {
    return { isValid: false, reason: "Only extract-video.ts is allowed" };
  }

  if (url !== undefined && !YOUTUBE_URL_PATTERN.test(url)) {
    return { isValid: false, reason: "Argument must be a valid YouTube URL" };
  }

  return { isValid: true };
}

function isUnderAllowedReadPath(filePath: string): boolean {
  const resolved = resolve(filePath);
  return ALLOWED_READ_ROOTS.some((root) => resolved === root || resolved.startsWith(root + sep));
}

type PermissionResult =
  | { readonly behavior: "allow" }
  | { readonly behavior: "deny"; readonly message: string };

const ALLOW: PermissionResult = { behavior: "allow" };

function checkReadPermission(toolName: string, input: Record<string, unknown>): PermissionResult {
  const filePath = input.file_path ?? input.path;
  if (typeof filePath !== "string") {
    return { behavior: "deny", message: `${toolName}: path is required` };
  }
  if (!isUnderAllowedReadPath(filePath)) {
    return {
      behavior: "deny",
      message: `${toolName} denied: path must be under skills/ or docs/. Got: ${filePath}`,
    };
  }
  return ALLOW;
}

function checkWritePermission(
  input: Record<string, unknown>,
  writeRoot: string,
  writePrefix: string,
): PermissionResult {
  const filePath = input.file_path;
  if (typeof filePath !== "string") {
    return { behavior: "deny", message: "Write: file_path is required" };
  }
  const resolved = resolve(filePath);
  if (resolved !== writeRoot && !resolved.startsWith(writePrefix)) {
    return {
      behavior: "deny",
      message: `Write denied: path must be under skills/. Got: ${filePath}`,
    };
  }
  return ALLOW;
}

function checkBashPermission(input: Record<string, unknown>): PermissionResult {
  const command = input.command;
  if (typeof command !== "string") {
    return { behavior: "deny", message: "Bash: command is required" };
  }
  const validation = validateBashCommand(command);
  if (!validation.isValid) {
    return { behavior: "deny", message: `Bash denied: ${validation.reason}` };
  }
  return ALLOW;
}

export function createToolPermissionGuard(): CanUseTool {
  const allowedWriteRoot = resolve(SKILLS_ROOT);
  const allowedWritePrefix = allowedWriteRoot + sep;

  return async (toolName, input) => {
    switch (toolName) {
      case "Read":
      case "Glob":
        return checkReadPermission(toolName, input);
      case "Write":
        return checkWritePermission(input, allowedWriteRoot, allowedWritePrefix);
      case "Bash":
        return checkBashPermission(input);
      case "WebSearch":
      case "WebFetch":
        return ALLOW;
      default:
        return { behavior: "deny", message: `${toolName} is not allowed for researcher` };
    }
  };
}
