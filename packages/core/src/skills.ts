import { readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { YOUTUBE_URL_PATTERN } from "./gemini";
import { EXTRACT_VIDEO_SCRIPT, SKILLS_ROOT } from "./paths";

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

// LLM とのパス契約を SKILLS_ROOT 基準に統一する。manifest 上は常に skills/... 表記。
// skills/ 始まりの仮想パスは SKILLS_ROOT 基準で解決。
// 絶対パスでも /skills/ を含み SKILLS_ROOT 配下でない場合は、cwd 取り違えとみなして
// SKILLS_ROOT 配下に再マップする（LLM が誤って packages/server/skills/... 等を組み立てるケース対策）。
export function resolveSkillPath(filePath: string): string {
  if (isAbsolute(filePath)) {
    const resolved = resolve(filePath);
    const skillsRoot = resolve(SKILLS_ROOT);
    if (resolved === skillsRoot || resolved.startsWith(skillsRoot + sep)) return resolved;
    const marker = `${sep}skills${sep}`;
    const idx = resolved.lastIndexOf(marker);
    if (idx !== -1) {
      return resolve(skillsRoot, resolved.slice(idx + marker.length));
    }
    return resolved;
  }
  const normalized = filePath.replace(/^\.\//, "");
  if (normalized === "skills" || normalized.startsWith("skills/")) {
    return resolve(SKILLS_ROOT, normalized.slice("skills/".length));
  }
  return resolve(filePath);
}

function formatManifest(filePaths: readonly string[]): string {
  return filePaths.map((filePath) => `- skills/${relative(SKILLS_ROOT, filePath)}`).join("\n");
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

const PACKAGE_ROOT = resolve(SKILLS_ROOT, "..");
const DOCS_ROOT = resolve(PACKAGE_ROOT, "..", "..", "docs");
const SHELL_META_CHARS = /[;|&`$(){}!<>\n\r\t]/;

const ALLOWED_READ_ROOTS = [resolve(SKILLS_ROOT), resolve(DOCS_ROOT)];

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

const BASH_ALLOWED_FORMAT =
  'Allowed: bun run packages/core/src/extract-video.ts "<youtube-url>" (URL must be quoted)';

function isAllowedScript(scriptPath: string): boolean {
  const scriptName = stripQuotes(scriptPath);
  const isAbsoluteMatch = resolve(scriptName) === EXTRACT_VIDEO_SCRIPT;
  const isRelativeMatch = EXTRACT_VIDEO_SCRIPT.endsWith(scriptName.replace(/^\.\//, ""));
  return isAbsoluteMatch || isRelativeMatch;
}

type ValidationResult = { isValid: true } | { isValid: false; reason: string };

function validateUrlArg(rawUrl: string): ValidationResult {
  const isQuoted =
    (rawUrl.startsWith('"') && rawUrl.endsWith('"')) ||
    (rawUrl.startsWith("'") && rawUrl.endsWith("'"));
  if (!isQuoted && rawUrl.includes("&")) {
    return {
      isValid: false,
      reason: `URL contains '&' and must be quoted. ${BASH_ALLOWED_FORMAT}`,
    };
  }
  const url = stripQuotes(rawUrl);
  if (!YOUTUBE_URL_PATTERN.test(url)) {
    return { isValid: false, reason: "Argument must be a valid YouTube URL" };
  }
  return { isValid: true };
}

export function validateBashCommand(command: string): ValidationResult {
  // LLM が `cd <dir> && bun run ...` の形式で生成するケースに対応
  const stripped = command.trim().replace(/^cd\s+(?:"[^"]+"|'[^']+'|\S+)\s*&&\s*/, "");

  const match = stripped.trim().match(/^(\S+)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/);
  if (!match) {
    return { isValid: false, reason: BASH_ALLOWED_FORMAT };
  }

  const [, runner, runCmd, scriptPath, rawUrl] = match;
  if (
    SHELL_META_CHARS.test(runner) ||
    SHELL_META_CHARS.test(runCmd) ||
    SHELL_META_CHARS.test(scriptPath)
  ) {
    return {
      isValid: false,
      reason: `Shell meta characters are not allowed. ${BASH_ALLOWED_FORMAT}`,
    };
  }

  if (runner !== "bun" || runCmd !== "run") {
    return { isValid: false, reason: `Only 'bun run' is allowed. ${BASH_ALLOWED_FORMAT}` };
  }

  if (!isAllowedScript(scriptPath)) {
    return { isValid: false, reason: "Only extract-video.ts is allowed" };
  }

  if (rawUrl !== undefined) {
    return validateUrlArg(rawUrl);
  }

  return { isValid: true };
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
  // skills/... の仮想パスは SKILLS_ROOT 基準で解決する
  const resolved =
    !isAbsolute(filePath) && (filePath.startsWith("skills/") || filePath === "skills")
      ? resolveSkillPath(filePath)
      : resolve(filePath);
  if (!ALLOWED_READ_ROOTS.some((root) => resolved === root || resolved.startsWith(root + sep))) {
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
  const resolved = resolveSkillPath(filePath);
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

/**
 * コーチループで使うツール権限の一元レジストリ。
 *
 * 背景: 従来、権限ルールは以下の 4 箇所に分散していて、ツール追加のたびに
 * すべての箇所を整合させる必要があった。特に `allowedTools` は
 * 「canUseTool をスキップして自動承認する」設定のため、同じツールを
 * allowedTools と canUseTool の両方に書くと、canUseTool の deny が
 * silent bypass されるバグを招いた（例: Bash の find を deny するはずが素通り）。
 *
 * ┌─────────────────────────────────────┬─────────────────────────────────────────────┐
 * │ tools: [...] (coach-loop.ts)        │ そもそも使えるツールの一覧                  │
 * ├─────────────────────────────────────┼─────────────────────────────────────────────┤
 * │ allowedTools: [...] (coach-loop.ts) │ canUseTool をスキップして自動承認するツール │
 * ├─────────────────────────────────────┼─────────────────────────────────────────────┤
 * │ canUseTool の switch (skills.ts)    │ ツールごとの allow/deny 判定ロジック        │
 * ├─────────────────────────────────────┼─────────────────────────────────────────────┤
 * │ onToolUse の switch (coach-loop.ts) │ 通知・警告ロジック                          │
 * └─────────────────────────────────────┴─────────────────────────────────────────────┘
 *
 * このレジストリは上記 1〜3 を 1 箇所に集約する。
 * - `tools`         → {@link COACH_TOOLS}（レジストリのキー集合）
 * - `allowedTools`  → {@link COACH_ALLOWED_TOOLS}（`kind: "auto-allow"` のツールだけ自動抽出）
 * - `canUseTool`    → {@link createToolPermissionGuard}（レジストリの `check` を束ねる）
 *
 * 4 層目の `onToolUse`（通知・警告）は観測層なので coach-loop.ts に残す。
 *
 * これにより「gated なのに allowedTools に入れる」ミスが構造的に起きなくなる。
 */
type ToolPolicy =
  | { readonly kind: "auto-allow" }
  | {
      readonly kind: "gated";
      readonly check: (input: Record<string, unknown>) => PermissionResult;
    };

const WRITE_ROOT = resolve(SKILLS_ROOT);
const WRITE_PREFIX = WRITE_ROOT + sep;

export const COACH_TOOL_POLICIES: Readonly<Record<string, ToolPolicy>> = {
  Read: { kind: "gated", check: (input) => checkReadPermission("Read", input) },
  Glob: { kind: "gated", check: (input) => checkReadPermission("Glob", input) },
  Write: { kind: "gated", check: (input) => checkWritePermission(input, WRITE_ROOT, WRITE_PREFIX) },
  Bash: { kind: "gated", check: checkBashPermission },
  Agent: { kind: "auto-allow" },
  WebSearch: { kind: "auto-allow" },
  WebFetch: { kind: "auto-allow" },
  TaskOutput: { kind: "auto-allow" },
};

export const COACH_TOOLS: readonly string[] = Object.keys(COACH_TOOL_POLICIES);

export const COACH_ALLOWED_TOOLS: readonly string[] = Object.entries(COACH_TOOL_POLICIES)
  .filter(([, policy]) => policy.kind === "auto-allow")
  .map(([name]) => name);

export function createToolPermissionGuard(): CanUseTool {
  return async (toolName, input) => {
    const policy = COACH_TOOL_POLICIES[toolName];
    if (policy === undefined) {
      return {
        behavior: "deny",
        message: `${toolName} is not registered in COACH_TOOL_POLICIES`,
      };
    }
    // SDK 内部は allow 応答に必ず `updatedInput: input` を詰めている。
    // 省くと "Orphaned permission: updatedInput is undefined" という warning が出て、
    // 下流のツール実行が異常終了し、Claude には ZodError として観測される。
    if (policy.kind === "auto-allow") {
      return { behavior: "allow", updatedInput: input };
    }
    const result = policy.check(input);
    if (result.behavior === "deny") return result;
    return { behavior: "allow", updatedInput: input };
  };
}
