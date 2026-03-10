import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type ClaudeConfig = {
  readonly mcpConfigPath: string | null;
  readonly isSystemPromptAppendEnabled: boolean;
  readonly isSubagentsEnabled: boolean;
};

type DashboardConfig = {
  readonly isEnabled: boolean;
  readonly port: number;
};

export type CoachConfig = {
  readonly engine: "claude";
  readonly intervalSeconds: number;
  readonly diffThresholdPercent: number;
  readonly maxImageWidthPx: number;
  readonly pixelmatchThreshold: number;
  readonly notification: "terminal" | "os" | "both";
  readonly dashboard: DashboardConfig;
  readonly claude: ClaudeConfig;
};

export const defaultConfig: CoachConfig = {
  engine: "claude",
  intervalSeconds: 5,
  diffThresholdPercent: 5,
  maxImageWidthPx: 1280,
  pixelmatchThreshold: 0.1,
  notification: "terminal",
  dashboard: {
    isEnabled: true,
    port: 3456,
  },
  claude: {
    mcpConfigPath: null,
    isSystemPromptAppendEnabled: true,
    isSubagentsEnabled: true,
  },
};

type ConfigErrorCode = "FILE_NOT_FOUND" | "PARSE_FAILED" | "VALIDATION_FAILED";

type LoadConfigSuccess = { readonly isOk: true; readonly config: CoachConfig };
type LoadConfigFailure = {
  readonly isOk: false;
  readonly errorCode: ConfigErrorCode;
  readonly message: string;
};
type LoadConfigResult = LoadConfigSuccess | LoadConfigFailure;

export type { LoadConfigResult };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function deepMerge(base: CoachConfig, partial: Record<string, unknown>): CoachConfig {
  const dashboard = isPlainObject(partial.dashboard) ? partial.dashboard : {};
  const claude = isPlainObject(partial.claude) ? partial.claude : {};

  return {
    engine: "claude",
    intervalSeconds: toFiniteNumber(partial.interval, base.intervalSeconds),
    diffThresholdPercent: toFiniteNumber(partial.threshold, base.diffThresholdPercent),
    maxImageWidthPx: toFiniteNumber(partial.maxImageWidthPx, base.maxImageWidthPx),
    pixelmatchThreshold: toFiniteNumber(partial.pixelmatchThreshold, base.pixelmatchThreshold),
    notification:
      partial.notification === "terminal" ||
      partial.notification === "os" ||
      partial.notification === "both"
        ? partial.notification
        : base.notification,
    dashboard: {
      isEnabled:
        typeof dashboard.enabled === "boolean" ? dashboard.enabled : base.dashboard.isEnabled,
      port: toFiniteNumber(dashboard.port, base.dashboard.port),
    },
    claude: {
      mcpConfigPath:
        typeof claude.mcpConfig === "string" ? claude.mcpConfig : base.claude.mcpConfigPath,
      isSystemPromptAppendEnabled:
        typeof claude.systemPromptAppend === "boolean"
          ? claude.systemPromptAppend
          : base.claude.isSystemPromptAppendEnabled,
      isSubagentsEnabled:
        typeof claude.useSubagents === "boolean"
          ? claude.useSubagents
          : base.claude.isSubagentsEnabled,
    },
  };
}

function validateConfig(config: CoachConfig): string | null {
  if (config.intervalSeconds < 1 || config.intervalSeconds > 300) {
    return `intervalSeconds must be 1-300, got ${config.intervalSeconds}`;
  }
  if (config.diffThresholdPercent < 0 || config.diffThresholdPercent > 100) {
    return `diffThresholdPercent must be 0-100, got ${config.diffThresholdPercent}`;
  }
  if (config.maxImageWidthPx < 320 || config.maxImageWidthPx > 7680) {
    return `maxImageWidthPx must be 320-7680, got ${config.maxImageWidthPx}`;
  }
  if (config.pixelmatchThreshold < 0 || config.pixelmatchThreshold > 1) {
    return `pixelmatchThreshold must be 0-1, got ${config.pixelmatchThreshold}`;
  }
  if (config.dashboard.port < 1024 || config.dashboard.port > 65535) {
    return `dashboard.port must be 1024-65535, got ${config.dashboard.port}`;
  }
  return null;
}

export async function loadConfig(configPath: string): Promise<LoadConfigResult> {
  const absolutePath = resolve(configPath);

  const raw = await readFile(absolutePath, "utf-8").catch(() => null);
  if (raw === null) {
    return {
      isOk: false,
      errorCode: "FILE_NOT_FOUND",
      message: `Config file not found: ${absolutePath}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { isOk: false, errorCode: "PARSE_FAILED", message: `Invalid JSON in ${absolutePath}` };
  }

  if (!isPlainObject(parsed)) {
    return {
      isOk: false,
      errorCode: "PARSE_FAILED",
      message: "config.json root must be an object",
    };
  }

  const merged = deepMerge(defaultConfig, parsed);
  const validationError = validateConfig(merged);
  if (validationError !== null) {
    return { isOk: false, errorCode: "VALIDATION_FAILED", message: validationError };
  }

  return { isOk: true, config: merged };
}
