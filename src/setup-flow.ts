import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import { listDisplays } from "./list-displays";
import type { Plan } from "./planner";
import { generatePlan } from "./planner";

type SetupResult = {
  readonly displayId: string;
  readonly displayName: string;
  readonly referenceImagePath: string;
  readonly goalDescription: string;
  readonly plan: Plan;
};

type SetupErrorCode =
  | "DISPLAY_LIST_FAILED"
  | "NO_DISPLAYS"
  | "PLAN_GENERATION_FAILED"
  | "USER_CANCELLED";

type SetupSuccess = {
  readonly isOk: true;
  readonly setup: SetupResult;
};

type SetupFailure = {
  readonly isOk: false;
  readonly errorCode: SetupErrorCode;
  readonly message: string;
};

type SetupFlowResult = SetupSuccess | SetupFailure;

export type { SetupResult, SetupFlowResult };

const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"];

function hasImageExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/") || filePath === "~") {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    return filePath.replace("~", home);
  }
  return filePath;
}

function printPlanToConsole(plan: Plan): void {
  const sep = "─".repeat(50);
  console.log(`\n${sep}`);
  console.log("  制作プラン");
  console.log(sep);
  console.log(`\n  目標: ${plan.goal}`);
  console.log(`  リファレンス分析: ${plan.referenceSummary}\n`);
  for (const step of plan.steps) {
    console.log(`  Step ${step.index}: [${step.application}] ${step.description}`);
  }
  console.log(`\n${sep}`);
}

export async function runSetupFlow(signal: AbortSignal): Promise<SetupFlowResult> {
  // 1. ディスプレイ選択
  const displaysResult = await listDisplays();
  if (!displaysResult.isOk) {
    return {
      isOk: false,
      errorCode: "DISPLAY_LIST_FAILED",
      message: displaysResult.message,
    };
  }

  if (displaysResult.displays.length === 0) {
    return {
      isOk: false,
      errorCode: "NO_DISPLAYS",
      message: "利用可能なディスプレイが見つかりません",
    };
  }

  const displays = displaysResult.displays;

  const selectedDisplay =
    displays.length === 1
      ? displays[0]
      : displays[
          await select({
            message: "監視対象のディスプレイを選択してください:",
            choices: displays.map((d, i) => ({
              name: d.name ?? `Display ${i + 1}`,
              value: i,
            })),
          })
        ];

  // 2. リファレンス画像パス入力
  const referenceImagePath = await input({
    message: "リファレンス画像のパスを入力してください:",
    validate: async (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return "パスを入力してください";
      if (!hasImageExtension(trimmed)) {
        return `対応形式: ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")}`;
      }
      const expanded = expandTilde(trimmed);
      const exists = await access(resolve(expanded))
        .then(() => true)
        .catch(() => false);
      if (!exists) return `ファイルが見つかりません: ${expanded}`;
      return true;
    },
  });

  // 3. 目標記述
  const goalDescription = await input({
    message: "目指す方向性・やりたいことを記述してください:",
    validate: (value) => {
      if (value.trim().length < 5) return "もう少し具体的に記述してください（5文字以上）";
      return true;
    },
  });

  // 4. プラン生成
  const resolvedReferencePath = resolve(expandTilde(referenceImagePath.trim()));
  const planResult = await generatePlan({
    referenceImagePath: resolvedReferencePath,
    goalDescription: goalDescription.trim(),
    signal,
  });

  if (!planResult.isOk) {
    return {
      isOk: false,
      errorCode: "PLAN_GENERATION_FAILED",
      message: planResult.message,
    };
  }

  // 5. プラン確認・修正ループ
  let currentPlan = planResult.plan;

  while (true) {
    printPlanToConsole(currentPlan);

    const isAccepted = await confirm({
      message: "このプランで作業を開始しますか?",
      default: true,
    });

    if (isAccepted) break;

    const feedback = await input({
      message: "プランの修正点を教えてください（'cancel'で中断）:",
      validate: (v) => (v.trim().length > 0 ? true : "修正点を入力してください"),
    });

    if (feedback.trim().toLowerCase() === "cancel") {
      return {
        isOk: false,
        errorCode: "USER_CANCELLED",
        message: "ユーザーがプランニングを中断しました",
      };
    }

    const revisedResult = await generatePlan({
      referenceImagePath: resolvedReferencePath,
      goalDescription: goalDescription.trim(),
      revisionFeedback: feedback.trim(),
      previousPlan: currentPlan,
      signal,
    });

    if (!revisedResult.isOk) {
      return {
        isOk: false,
        errorCode: "PLAN_GENERATION_FAILED",
        message: revisedResult.message,
      };
    }

    currentPlan = revisedResult.plan;
  }

  return {
    isOk: true,
    setup: {
      displayId: selectedDisplay.id,
      displayName: selectedDisplay.name ?? "Unknown",
      referenceImagePath: resolvedReferencePath,
      goalDescription: goalDescription.trim(),
      plan: currentPlan,
    },
  };
}
