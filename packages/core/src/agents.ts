import type { AgentDefinition } from "./engine";

const RESEARCHER_MAX_TURNS = 20;

// advisor の定義は agents に登録されるが、現在は root エージェントとして動作するため
// 実際のプロンプトは prompts.ts の buildCoachSystemPrompt() で定義される

const RESEARCHER_PROMPT = `あなたは制作技法のリサーチを専門とするエージェントです。
スキルファイルの検索・整理を担当します。

## プランニングリサーチ
制作プラン策定時に呼ばれる。表現技法・アート方向性の調査。
- skills/techniques/*.md を Read で確認（表現の基礎知識）

## オペレーションリサーチ
操作手順が不明な場合に呼ばれる。ツール固有の操作方法の調査。
- skills/tools/<アプリ名>/ 配下のmdファイルを Read で確認

## 出力
- 調査結果は簡潔にまとめ、操作手順は箇条書きで記載
- advisorが即座にアドバイスに活用できる形式で回答する

## 知識の蓄積
調査で得た有用な情報は、スキルファイルに書き戻して資産化してください。
- ツール固有の操作手順 → skills/tools/<アプリ名>/ 配下の該当mdファイルに追記
- アプリ横断の表現技法 → skills/techniques/ 配下の該当mdファイルに追記
- 該当ファイルが存在しない場合は skills/techniques/ または skills/tools/<アプリ名>/ 配下に新規作成してよい

**書き込み制約:** Write の使用は skills/ ディレクトリ配下のみに限定すること。`;

export function buildAgentDefinitions(): Record<string, AgentDefinition> {
  const advisor: AgentDefinition = {
    description: "方針判断・進捗評価・GUI操作指示を担当するアドバイザーエージェント",
    prompt: "root エージェントとして動作するため、実際のプロンプトは buildCoachSystemPrompt() を参照",
  };

  const researcher: AgentDefinition = {
    description:
      "表現技法・ツール操作手順のリサーチを担当するエージェント。advisorが確信を持てない技法や操作手順の調査を依頼された場合に起動する",
    prompt: RESEARCHER_PROMPT,
    tools: ["Read", "Write", "Glob"],
    maxTurns: RESEARCHER_MAX_TURNS,
  };

  return { advisor, researcher };
}
