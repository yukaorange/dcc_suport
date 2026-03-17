# @dcc/core リーディングガイド

> 最終更新: 2026-03-17

## このパッケージの役割

`@dcc/core` はコーチングのドメインロジックを集約したパッケージ。server / cli の両方から利用される共有基盤。

ただし「純粋関数だけ」ではない点に注意。スクリーンキャプチャ（OS API）、ファイルI/O（一時PNG書出）、外部API呼出（Claude SDK, Gemini API）など副作用を伴う処理も含まれる。`diff.ts` や `planner.ts` の解析ロジックは純粋だが、パッケージ全体としては副作用を持つ。

## ファイルマップ

```text
packages/core/src/
├── index.ts            ← バレルexport（全公開APIの窓口）
│
│ ── コーチングループ ──
├── coach-loop.ts       ← [最重要] コーチングの心臓部
├── engine.ts           ← Claude Agent SDK ラッパー
├── prompts.ts          ← システム/ユーザープロンプト構築（ループ毎回使用）
├── agents.ts           ← マルチエージェント定義 ADVISOR / RESEARCHER（ループ毎回使用）
├── skills.ts           ← スキルファイルパス収集・ツール権限ガード（ループ毎回使用）
│
│ ── キャプチャ・差分 ──
├── capture.ts          ← スクリーンキャプチャ（screenshot-desktop + sharp）
├── diff.ts             ← 画像差分検出（pixelmatch）— 純粋関数
│
│ ── プラン生成 ──
├── planner.ts          ← プラン生成（Claude呼出→JSON解析）
│
│ ── ユーティリティ ──
├── config.ts           ← config.json 読込
├── list-displays.ts    ← ディスプレイ一覧取得
├── paths.ts            ← プロジェクトパス定数
├── output.ts           ← CLI向けイベント表示
├── gemini.ts           ← YouTube動画からDCC技法を抽出（Gemini API）
└── extract-video.ts    ← gemini.ts のCLIエントリ
```

## 全体フロー: コーチングループの1サイクル

これが core の核心。`startCoachLoop()` が呼ばれると、以下のサイクルが abort されるまで繰り返される。

```mermaid
flowchart TD
    A["startCoachLoop()"] --> P["buildCoachSystemPrompt()\nbuildAgentDefinitions()\ncreateToolPermissionGuard()"]
    P --> B["captureScreen()"]
    B --> C{"前回キャプチャと比較\ncomputeDiff()"}
    C -->|変化なし / 微小| D["onEvent: no_change / diff_skipped"]
    D --> E["インターバル待機"]
    E --> B
    C -->|変化あり| F["onEvent: querying"]
    F --> G["buildCoachUserPrompt()\n↓\ninvokeClaude()\nAdvisor Agent に画像送信"]
    G -->|成功| H["onEvent: advice"]
    H --> E
    G -->|失敗| K["onEvent: engine_error"]
    K --> E

    style A fill:#e1f5fe
    style P fill:#f3e5f5
    style G fill:#fff3e0
    style H fill:#e8f5e9
```

**注意**: `prompts.ts`, `agents.ts`, `skills.ts` はループの各サイクルで使用される。後回しにせず `coach-loop.ts` と一緒に読むこと。

**読むべきファイル**: `coach-loop.ts` → `prompts.ts` + `agents.ts` + `skills.ts` → `engine.ts`

## 重要な型: LoopEvent

coach-loop が `onEvent` コールバックで通知するイベント。server の EventBus はこれに `sessionId` をタグ付けして配信する。

```mermaid
graph LR
    subgraph "LoopEvent (coach-loop.ts)"
        capture_failed
        diff_skipped
        no_change
        user_message_received
        querying
        advice["advice（CoachAdvice）"]
        silent
        engine_error
        session_lost
        plan_step_updated
    end
```

> `started` と `stopped` は LoopEvent の union に含まれるが、**core 内では発火されない**。`stopped` は server 側の `coach-session.ts` が `loopFinished` Promise 解決後に EventBus へ publish する。

| イベント | 意味 | UIでの表示 |
|---------|------|-----------|
| `advice` | Claudeからのアドバイス到着 | ダッシュボードに表示 |
| `engine_error` | Claude呼出失敗 | エラー表示 |
| `plan_step_updated` | プランステップ進捗更新 | 進捗バッジ変化 |
| `user_message_received` | ユーザーからのメッセージ到着 | (内部フロー) |
| `stopped` | ループ終了 (**server側で発火**) | 「終了」バッジ |

## プラン生成フロー

セットアップ時に実行。ループとは別のフロー。再生成時は `revisionFeedback` + `previousPlan` を渡して修正プランを生成する。

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Planner as planner.ts
    participant Engine as engine.ts
    participant Claude as Claude API

    Client->>Server: plan.generate(image, goal)
    Server->>Planner: generatePlan(input)
    Planner->>Planner: buildPlanGenerationPrompt()
    Planner->>Engine: invokeClaude(prompt)
    Engine->>Claude: Agent SDK 呼出
    Claude-->>Engine: テキスト応答（JSON）
    Engine-->>Planner: EngineResult
    Planner->>Planner: parsePlanFromResponse()
    Planner-->>Server: GeneratePlanResult
    Server-->>Client: { planId, plan }

    Note over Client,Server: 再生成時
    Client->>Server: plan.generate(image, goal, feedback, previousPlanId)
    Server->>Server: pendingPlanCache.get(previousPlanId) → previousPlan
    Server->>Planner: generatePlan({ ...input, revisionFeedback, previousPlan })
```

**読むべきファイル**: `planner.ts` のみ。プロンプト構造を知りたければ `prompts.ts`

## engine.ts: Claude Agent SDK ラッパー

```mermaid
flowchart LR
    A["invokeClaude(options)"] --> B["Agent SDK\nstreaming実行"]
    B --> C{"結果"}
    C -->|成功| D["{ isOk: true, result }"]
    C -->|タイムアウト| E["{ isOk: false, TIMEOUT }"]
    C -->|中断| F["{ isOk: false, ABORTED }"]
    C -->|その他| G["{ isOk: false, SDK_ERROR }"]

    style A fill:#e1f5fe
```

- `signal` (AbortSignal) でキャンセル可能
- `checkSessionContinuity()` はセッション維持チェック（画面遷移検出用）

## スキルシステム

```mermaid
flowchart TD
    A["loadSkillManifest(applications)"] --> B["skills/ 配下の .md を検索"]
    B --> C["相対ファイルパス一覧を返す"]
    C --> D["system prompt に埋め込み\n→ Researcher Agent が必要なファイルを Read"]

    E["createToolPermissionGuard()"] --> F{"ツール種別で分岐"}
    F -->|"Read / Glob"| G["skills/ または docs/ 配下のみ許可"]
    F -->|"Write"| H["skills/ 配下のみ許可"]
    F -->|"Bash"| I["extract-video.ts 限定"]
    F -->|"WebSearch / WebFetch"| J["常に許可"]
    F -->|"その他"| K["拒否"]
```

スキルファイルは Photoshop 等のツール操作手順書。`loadSkillManifest()` はファイルの**内容**ではなく**パス一覧**を返す。Agent が必要に応じて Read ツールで中身を参照する設計。

## 読む順番の推奨

1. **`index.ts`** — 何がexportされているか全体像を把握
2. **`coach-loop.ts`** — 最重要。ループ全体のフローを理解
3. **`prompts.ts` + `agents.ts` + `skills.ts`** — ループの各サイクルで使われるプロンプト構築・エージェント定義・権限ガード
4. **`engine.ts`** — Claude呼出の仕組み
5. **`planner.ts`** — プラン生成の仕組み
6. **`capture.ts` + `diff.ts`** — スクリーンキャプチャと差分検出

残り（config, list-displays, paths, output, gemini）は必要になったときに読めばよい。
