// coach-loop.ts と prompts.ts の両方が参照する型を集約することで
// 循環 import を回避するための共通モジュール。
type LoopMode = "manual" | "auto";

type RoundTrigger = "initial" | "timer" | "user_message" | "manual_next";

type UserMessage = {
  readonly text: string;
  readonly imagePaths: readonly string[];
};

// ユーザーが選択したモデル。null はデフォルト（CLI設定に従う）を意味する。
// supportsEffort を一緒に持ち回るのは、effort 非対応モデルに effort を渡すと
// SDK がエラーになるため、ラウンド実行時に effort を省略する判定に使うから。
type SelectedModel = {
  readonly value: string;
  readonly supportsEffort: boolean;
};

export type { LoopMode, RoundTrigger, SelectedModel, UserMessage };
