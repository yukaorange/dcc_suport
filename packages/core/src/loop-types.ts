// coach-loop.ts と prompts.ts の両方が参照する型を集約することで
// 循環 import を回避するための共通モジュール。
type LoopMode = "manual" | "auto";

type RoundTrigger = "initial" | "timer" | "user_message" | "manual_next";

type UserMessage = {
  readonly text: string;
  readonly imagePaths: readonly string[];
};

export type { LoopMode, RoundTrigger, UserMessage };
