import { invokeClaude } from "./engine";

type PlanStepStatus = "pending" | "in_progress" | "completed";

type PlanStep = {
  readonly index: number;
  readonly application: string;
  readonly description: string;
  readonly status: PlanStepStatus;
};

type Plan = {
  readonly goal: string;
  readonly referenceSummary: string;
  readonly steps: readonly PlanStep[];
};

export type { Plan, PlanStep, PlanStepStatus };

type PlannerErrorCode = "ENGINE_FAILED" | "PARSE_FAILED";

type GeneratePlanSuccess = { readonly isOk: true; readonly plan: Plan };
type GeneratePlanFailure = {
  readonly isOk: false;
  readonly errorCode: PlannerErrorCode;
  readonly message: string;
};
type GeneratePlanResult = GeneratePlanSuccess | GeneratePlanFailure;

export type { GeneratePlanResult };

type GeneratePlanInput = {
  readonly referenceImagePath: string;
  readonly goalDescription: string;
  readonly revisionFeedback?: string;
  readonly previousPlan?: Plan;
  readonly signal?: AbortSignal;
};

export type { GeneratePlanInput };

const PLAN_SYSTEM_PROMPT = `あなたはDCCツールの制作プランナーです。リファレンス画像を分析し、ユーザーの目標に基づいた制作プランを生成します。
表現技法の性質から最適なアプリを判断し、アプリ間の制作フロー（Illustrator→Photoshop等）を設計してください。`;

function buildPlanGenerationPrompt(input: GeneratePlanInput): string {
  if (input.revisionFeedback !== undefined && input.previousPlan !== undefined) {
    return `前回のプランに対してユーザーから修正フィードバックがありました。

前回のプラン:
${JSON.stringify(input.previousPlan, null, 2)}

ユーザーのフィードバック: ${input.revisionFeedback}

修正したプランを同じJSON形式で出力してください。JSON以外のテキストは含めないでください。`;
  }

  return `以下の情報をもとに、制作プランを生成してください。

## リファレンス画像
${input.referenceImagePath}

## ユーザーの目標
${input.goalDescription}

## 出力フォーマット
以下のJSON形式で出力してください。JSON以外のテキストは含めないでください:
{
  "goal": "ユーザーの目標を解釈し、制作方針を提言",
  "referenceSummary": "リファレンス画像の分析結果（表現の特徴、色使い、技法など）",
  "steps": [
    { "index": 1, "application": "使用アプリ名", "description": "作業内容" }
  ]
}

## 注意
- 各ステップで使用するアプリケーション（Illustrator / Photoshop / After Effects等）を明示
- 表現技法の性質から最適なアプリを判断（ベクター作業→Illustrator、テクスチャ加工→Photoshop等、エフェクト作成→After Effects等）
- ステップは5-10個程度の粒度`;
}

function sanitizeStepField(value: string, maxLength: number): string {
  return value.replace(/\n/g, " ").trim().slice(0, maxLength);
}

function parsePlanFromResponse(responseText: string): Plan | null {
  const jsonMatch =
    responseText.match(/```json\s*([\s\S]*?)```/) ?? responseText.match(/(\{[\s\S]*\})/);
  if (jsonMatch === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[1].trim());
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.goal !== "string") return null;
  if (typeof obj.referenceSummary !== "string") return null;
  if (!Array.isArray(obj.steps)) return null;

  const steps: PlanStep[] = [];
  for (const raw of obj.steps) {
    if (typeof raw !== "object" || raw === null) return null;
    const s = raw as Record<string, unknown>;
    if (
      typeof s.index !== "number" ||
      typeof s.application !== "string" ||
      typeof s.description !== "string"
    ) {
      return null;
    }
    steps.push({
      index: s.index,
      application: sanitizeStepField(s.application, 800),
      description: sanitizeStepField(s.description, 800),
      status: "pending",
    });
  }

  return { goal: obj.goal, referenceSummary: obj.referenceSummary, steps };
}

export async function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  // @throws — SDK レベルのエラー
  const engineResult = await invokeClaude({
    prompt: buildPlanGenerationPrompt(input),
    appendSystemPrompt: PLAN_SYSTEM_PROMPT,
    permissionMode: "bypassPermissions",
    allowedTools: [],
    maxTurns: 3,
    timeoutMs: 120_000,
    signal: input.signal,
  });

  if (!engineResult.isOk) {
    return {
      isOk: false,
      errorCode: "ENGINE_FAILED",
      message: `[${engineResult.errorCode}] ${engineResult.message}`,
    };
  }

  const plan = parsePlanFromResponse(engineResult.result);
  if (plan === null) {
    return {
      isOk: false,
      errorCode: "PARSE_FAILED",
      message: "AI応答からプランのJSONを抽出できませんでした",
    };
  }

  return { isOk: true, plan };
}

export function updateStepStatus(plan: Plan, stepIndex: number, newStatus: PlanStepStatus): Plan {
  return {
    ...plan,
    steps: plan.steps.map((step) =>
      step.index === stepIndex ? { ...step, status: newStatus } : step,
    ),
  };
}
