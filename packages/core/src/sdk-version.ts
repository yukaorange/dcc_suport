import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SDK_PACKAGE_NAME = "@anthropic-ai/claude-agent-sdk";
const REGISTRY_TIMEOUT_MS = 5_000;

type SdkVersionStatus =
  | { readonly kind: "up_to_date"; readonly installed: string; readonly latest: string }
  | { readonly kind: "outdated"; readonly installed: string; readonly latest: string }
  | { readonly kind: "unknown"; readonly reason: string };

export type { SdkVersionStatus };

// "0.3.299-beta+build" → [0, 3, 299]。セマンティックバージョンとして解釈できなければ null
function parseVersionParts(version: string): readonly [number, number, number] | null {
  const releaseCore = version.split(/[-+]/)[0];
  const segments = releaseCore.split(".");
  if (segments.length === 0 || segments.length > 3) return null;

  const numbers = segments.map((s) => (/^\d+$/.test(s) ? Number(s) : Number.NaN));
  if (numbers.some(Number.isNaN)) return null;

  return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0];
}

// functional core: 入力（2つのバージョン文字列）から状態を導出する純関数
export function deriveSdkVersionStatus(
  installed: string | null,
  latest: string | null,
): SdkVersionStatus {
  if (installed === null) {
    return { kind: "unknown", reason: "インストール済みのSDKバージョンを特定できませんでした" };
  }
  if (latest === null) {
    return { kind: "unknown", reason: "npmレジストリから最新バージョンを取得できませんでした" };
  }

  const installedParts = parseVersionParts(installed);
  const latestParts = parseVersionParts(latest);
  if (installedParts === null || latestParts === null) {
    return {
      kind: "unknown",
      reason: `バージョン文字列を解釈できませんでした (installed=${installed}, latest=${latest})`,
    };
  }

  for (let i = 0; i < 3; i++) {
    if (installedParts[i] < latestParts[i]) return { kind: "outdated", installed, latest };
    if (installedParts[i] > latestParts[i]) return { kind: "up_to_date", installed, latest };
  }
  return { kind: "up_to_date", installed, latest };
}

// SDK のエントリファイルの隣にある package.json から実際にインストールされている
// バージョンを読む。自パッケージの依存指定（^0.3.x 等）ではなく実体を見るため
async function getInstalledSdkVersion(): Promise<string | null> {
  // 失敗してもアプリ動作に影響しない診断機能のため、ここで握りつぶして null を返す
  try {
    const entryUrl = import.meta.resolve(SDK_PACKAGE_NAME);
    const packageJsonPath = join(dirname(fileURLToPath(entryUrl)), "package.json");
    const raw = await readFile(packageJsonPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const version = (parsed as { readonly version?: unknown }).version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

async function fetchLatestSdkVersion(): Promise<string | null> {
  // オフライン・タイムアウト時は警告を出さずスキップする契約のため、ここで握りつぶす
  try {
    const response = await fetch(`https://registry.npmjs.org/${SDK_PACKAGE_NAME}/latest`, {
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) return null;
    const version = (body as { readonly version?: unknown }).version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

// mutable shell: IO を束ねる薄い入口。失敗はすべて "unknown" に落ちるため reject しない
export async function checkSdkVersionStatus(): Promise<SdkVersionStatus> {
  const [installed, latest] = await Promise.all([
    getInstalledSdkVersion(),
    fetchLatestSdkVersion(),
  ]);
  return deriveSdkVersionStatus(installed, latest);
}
