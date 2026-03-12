# アーキテクチャ概要

更新日: 2026-03-12

## 全体フロー（現行 + DCC-7）

起動からコーチングまでの全体の流れ。灰色のノードは DCC-7 で追加される部分。

```mermaid
flowchart TD
    Start([bun run start]) --> LoadConfig["config.ts<br>loadConfig()"]
    LoadConfig --> Setup["setup-flow.ts<br>runSetupFlow()"]

    Setup --> SelectDisplay["ディスプレイ選択<br>listDisplays() → inquirer"]
    SelectDisplay --> InputRef["リファレンス画像入力<br>inquirer"]
    InputRef --> InputGoal["目標記述入力<br>inquirer"]
    InputGoal --> GenPlan["planner.ts<br>generatePlan()"]
    GenPlan --> ConfirmPlan{"プラン承認？"}
    ConfirmPlan -->|修正| GenPlan
    ConfirmPlan -->|承認| LoadManifest

    LoadManifest["skills.ts<br>loadSkillManifest()"]:::dcc7
    LoadManifest --> StartLoop["coach-loop.ts<br>startCoachLoop()"]

    subgraph loop ["コーチングループ（5秒間隔）"]
        Capture["capture.ts<br>captureScreen()"]
        Diff["diff.ts<br>computeDiff()"]
        BuildPrompt["prompts.ts<br>buildCoachSystemPrompt()<br>buildCoachUserPrompt()"]
        Engine["engine.ts<br>invokeClaude()"]
        Parse["parseAdvice()"]

        Capture --> CheckFirst{初回？}
        CheckFirst -->|Yes| BuildPrompt
        CheckFirst -->|No| CheckMsg{ユーザー<br>メッセージ？}
        CheckMsg -->|Yes| BuildPrompt
        CheckMsg -->|No| Diff
        Diff -->|変化あり| BuildPrompt
        Diff -->|変化なし| Sleep
        BuildPrompt --> Engine
        Engine --> Parse
        Parse --> Sleep[5秒スリープ<br>or ユーザー入力]
        Sleep --> Capture
    end

    StartLoop --> Capture

    subgraph subagents ["サブエージェント（DCC-7）"]:::dcc7box
        Coach["coach<br>方向性判断・GUI案内"]:::dcc7
        Researcher["researcher<br>多段探索・知識蓄積"]:::dcc7
    end

    Engine -.->|"isSubagentsEnabled<br>= true"| subagents

    classDef dcc7 fill:#e8eaf6,stroke:#5c6bc0
    classDef dcc7box fill:#f5f5ff,stroke:#9fa8da
```

## モジュール構成と関数マップ

各ソースファイルが持つ export 関数と、その依存関係。

```mermaid
flowchart LR
    subgraph entry ["エントリポイント"]
        index["index.ts"]
    end

    subgraph setup ["セットアップ"]
        config["config.ts<br>─────────────<br>loadConfig()<br>defaultConfig"]
        setupFlow["setup-flow.ts<br>─────────────<br>runSetupFlow()"]
        listDisp["list-displays.ts<br>─────────────<br>listDisplays()"]
        planner["planner.ts<br>─────────────<br>generatePlan()<br>updateStepStatus()"]
    end

    subgraph core ["コアループ"]
        coachLoop["coach-loop.ts<br>─────────────<br>startCoachLoop()<br>executeOneRound()"]
        capture["capture.ts<br>─────────────<br>captureScreen()"]
        diff["diff.ts<br>─────────────<br>computeDiff()"]
        prompts["prompts.ts<br>─────────────<br>buildCoachSystemPrompt()<br>buildCoachUserPrompt()"]
        engine["engine.ts<br>─────────────<br>invokeClaude()<br>checkSessionContinuity()"]
        output["output.ts<br>─────────────<br>printLoopEvent()<br>printSetupEvent()"]
    end

    subgraph dcc7 ["DCC-7 新規"]
        skills["skills.ts<br>─────────────<br>buildSkillManifest()<br>loadSkillManifest()<br>createResearcherPermissionGuard()"]:::new
        agents["agents.ts<br>─────────────<br>buildAgentDefinitions()"]:::new
        gemini["gemini.ts<br>─────────────<br>extractVideoContent()"]:::new
        extractVideo["extract-video.ts<br>─────────────<br>CLIエントリポイント"]:::new
    end

    index --> config
    index --> setupFlow
    index --> coachLoop
    index --> output
    index --> skills

    setupFlow --> listDisp
    setupFlow --> planner
    planner --> engine

    coachLoop --> capture
    coachLoop --> diff
    coachLoop --> prompts
    coachLoop --> engine
    coachLoop --> agents
    coachLoop --> skills

    extractVideo --> gemini

    classDef new fill:#e8eaf6,stroke:#5c6bc0
```

## データフロー: セットアップからコーチングまで

```mermaid
flowchart LR
    Config["config.json"] -->|"loadConfig()"| CoachConfig["CoachConfig"]
    Ref["リファレンス画像パス"] -->|"runSetupFlow()"| Plan["Plan"]
    Goal["目標テキスト"] -->|"runSetupFlow()"| Plan

    Plan -->|"loadSkillManifest()"| Manifest["スキル目次<br>ファイルパス一覧"]:::dcc7

    CoachConfig --> Loop["startCoachLoop()"]
    Plan --> Loop
    Manifest --> Loop
    Ref --> Loop

    Loop -->|"buildCoachSystemPrompt()"| SysPrompt["システムプロンプト<br>+ スキル目次"]
    Loop -->|"buildCoachUserPrompt()"| UserPrompt["ユーザープロンプト<br>+ スクリーンショット"]

    SysPrompt --> Engine["invokeClaude()"]
    UserPrompt --> Engine

    Engine -->|"isSubagentsEnabled"| SDK["Claude Agent SDK<br>query()"]
    SDK --> Result["応答テキスト<br>or __SILENT__"]

    classDef dcc7 fill:#e8eaf6,stroke:#5c6bc0
```

## キャプチャ・差分検知パイプライン

デスクトップ画面の取得から差分率算出までの流れ。

```mermaid
flowchart LR
    A["デスクトップ画面"] --> B["screenshot-desktop<br>OS命令で画面を撮影"]
    B --> C["sharp<br>resize(1280px)<br>ensureAlpha(RGBA)<br>raw pixels 取得<br>→ PNG 再エンコード"]
    C --> D["capture.ts が返すもの<br>- pngBuffer<br>- rawPixels<br>- widthPx<br>- heightPx"]
    D -->|"pngBuffer"| E["AI送信用"]
    D -->|"rawPixels"| F["diff.ts<br>(pixelmatch)"]
    G["前回の rawPixels"] --> F
    F --> H["diffRatePercent<br>例: 42.5% 変化"]
```

### captureScreen の内部フロー

```mermaid
flowchart TD
    A["captureScreen(config)"] --> B["screenshot({ format: 'png' })"]
    B -->|失敗| C["{ isOk: false,<br>errorCode: SCREENSHOT_FAILED }"]
    B -->|成功| D["buildCapturedImage(buffer, maxWidthPx)<br>← functional core"]
    D --> E["sharp: resize + ensureAlpha + raw"]
    E --> F["rawPixels (Uint8Array, RGBA)"]
    F --> G["sharp: raw → PNG 再エンコード"]
    G --> H["pngBuffer (Buffer)"]
    D -->|失敗| I["{ isOk: false,<br>errorCode: RESIZE_FAILED }"]
    H --> J["{ isOk: true,<br>image: CapturedImage }"]
```

### functional core / mutable shell の分離

```mermaid
graph TB
    subgraph shell ["captureScreen (mutable shell)"]
        direction TB
        S1["OS スクリーンショット取得（副作用）"]
        S2["エラーを Result 型に変換"]
        subgraph core ["buildCapturedImage (functional core)"]
            C1["sharp パイプライン（純粋な変換処理）"]
            C2["PNG Buffer → raw pixels → PNG"]
        end
        S1 --> core
        core --> S2
    end
```

### computeDiff のガード節

```mermaid
flowchart TD
    A["computeDiff(input)"] --> G1{"threshold が<br>0.0-1.0 の範囲内？"}
    G1 -->|No| E1["INVALID_THRESHOLD"]
    G1 -->|Yes| G2{"widthPx / heightPx が<br>ゼロでない？"}
    G2 -->|No| E2["INVALID_BUFFER_SIZE"]
    G2 -->|Yes| G3{"current と previous の<br>サイズが一致？"}
    G3 -->|No| E3["DIMENSION_MISMATCH"]
    G3 -->|Yes| G4{"バッファ長 =<br>w × h × 4 ？"}
    G4 -->|No| E4["INVALID_BUFFER_SIZE"]
    G4 -->|Yes| P["pixelmatch()"]
    P --> R["{ isOk: true,<br>diffRatePercent }"]
```

### 2つの threshold の違い

| 名前 | 範囲 | 意味 | 使用箇所 |
|------|------|------|----------|
| `pixelmatchThreshold` | 0.0 - 1.0 | ピクセル単位の色差感度。「2つのピクセルの色がどれくらい違ったら '違う' とみなすか」 | diff.ts が pixelmatch に渡す |
| `diffThresholdPercent` | 例: 5% | 画面全体の変化率の閾値。「画面の何%が変わったら AI に送信するか」 | coach-loop が判定 |

### 型の関係（疎結合）

```mermaid
graph LR
    subgraph capture ["capture.ts"]
        CI["CapturedImage<br>- pngBuffer<br>- rawPixels<br>- widthPx<br>- heightPx"]
    end

    subgraph diff ["diff.ts"]
        DI["DiffInput"]
    end

    CI -->|"Uint8Array + number<br>（型を import しない）"| DI
```

> diff.ts は capture.ts の型を import しない。Uint8Array + プリミティブだけで繋がる疎結合設計。

## コーチングループ詳細

### メインループフロー

```mermaid
flowchart TD
    Start([ループ開始]) --> Capture[画面キャプチャ]
    Capture -->|失敗| LogError[エラーログ出力]
    LogError --> Sleep

    Capture -->|成功| CheckFirst{初回？}
    CheckFirst -->|Yes| SaveFile[一時ファイルに保存]
    CheckFirst -->|No| CheckMsg{ユーザー<br>メッセージあり？}

    CheckMsg -->|Yes| SaveFile
    CheckMsg -->|No| Diff[前回画像と差分検知]

    Diff -->|差分あり| SaveFile
    Diff -->|差分なし| Sleep

    SaveFile --> Query[AI に問い合わせ]
    Query --> ParseResult{応答を解析}

    ParseResult -->|テキスト| ShowAdvice[ターミナルに表示]
    ParseResult -->|__SILENT__| Silent[何も表示しない]
    ParseResult -->|エラー| EngineError[エラーログ出力]

    ShowAdvice --> Sleep
    Silent --> Sleep
    EngineError --> Sleep

    Sleep[5秒スリープ] -->|タイマー満了| Capture
    Sleep -->|ユーザー入力で中断| Capture
    Sleep -->|Ctrl+C| Stop([ループ終了])
```

### 双方向チャンネル（MessageBox パターン）

ユーザーが stdin から入力したメッセージを MessageBox にバッファし、<br>ループ側の sleep を中断して即座に AI を呼び出す仕組み。

```mermaid
sequenceDiagram
    participant User as ユーザー（stdin）
    participant RL as readline
    participant MB as MessageBox
    participant Loop as コーチループ
    participant AI as Claude API

    Note over Loop: 5秒スリープ中...

    User->>RL: "ここどうすればいい？" + Enter
    RL->>MB: submit("ここどうすればいい？")
    MB-->>Loop: sleep 中断

    Loop->>MB: consume()
    MB-->>Loop: "ここどうすればいい？"

    Loop->>Loop: 画面キャプチャ（diff はスキップ）
    Loop->>AI: メッセージ + スクリーンショット
    AI-->>Loop: 応答テキスト
    Loop->>User: ターミナルに表示

    Note over Loop: 再び5秒スリープ...
```

### AI の判断パターン

```mermaid
flowchart LR
    Input[画面 + 文脈] --> Judge{AI の判断}

    Judge -->|アドバイスあり| Text["テキスト応答 → 表示"]
    Judge -->|静観すべき| Silent["__SILENT__ → 非表示"]
    Judge -->|声かけ| Encourage["テキスト応答 → 表示"]

    UserMsg[ユーザーメッセージ<br>がある場合] -->|__SILENT__ 禁止| MustRespond["必ずテキストで応答"]
```

### 3-case プロンプト分岐

AI に送るユーザープロンプトは状況に応じて 3 パターンに分岐する。

```mermaid
flowchart TD
    BuildPrompt[buildCoachUserPrompt] --> IsFirst{初回ラウンド？}

    IsFirst -->|Yes| FirstPrompt["「最初のスクリーンショットです。<br>何をしようとしているか観察してください」"]
    IsFirst -->|No| HasMsg{ユーザー<br>メッセージあり？}

    HasMsg -->|Yes| MsgPrompt["「ユーザーからメッセージがあります。<br>画面も参考にして回答してください」<br>+ メッセージ本文"]
    HasMsg -->|No| DiffPrompt["「前回から画面に変化がありました」"]

    FirstPrompt --> Attach[+ スクリーンショットパス]
    MsgPrompt --> Attach
    DiffPrompt --> Attach
```

### グレースフルシャットダウン

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Process as プロセス
    participant AC as AbortController
    participant RL as readline
    participant Loop as コーチループ
    participant Tmp as 一時ファイル

    User->>Process: Ctrl+C（SIGINT）
    Process->>AC: abort()
    Process->>RL: close()
    AC-->>Loop: signal.aborted = true
    Loop->>Loop: while ループ脱出
    Loop->>Tmp: 一時ファイル削除
    Loop-->>Process: done Promise 解決
    Process->>Process: プロセス終了
```

## サブエージェント構成（DCC-7）

親エージェントがコンテキスト（スクリーンショット・会話履歴・プラン）を保持し、<br>必要に応じて子エージェントに委譲する。

```mermaid
flowchart TD
    Parent["親エージェント<br>（invokeClaude で起動）<br>───────────<br>tools: Agent のみ<br>canUseTool: permissionGuard"]

    Parent -->|"方向性判断が必要"| Coach["coach<br>───────────<br>方向性・美的判断<br>GUI操作案内<br>進捗評価"]

    Parent -->|"調査が必要"| Researcher["researcher<br>───────────<br>tools: WebSearch, WebFetch,<br>Read, Write, Bash, Glob"]

    Researcher -->|"1. スキルファイル"| SkillRead["Read<br>skills/techniques/*.md<br>skills/tools/app/*.md"]
    Researcher -->|"2. ブログ記事"| WebSearch["WebSearch + WebFetch"]
    Researcher -->|"3. YouTube動画"| Bash["Bash<br>bun run src/extract-video.ts"]

    Bash --> Gemini["gemini.ts<br>extractVideoContent()<br>Gemini 2.5 Flash API"]

    Researcher -->|"蓄積"| SkillWrite["Write<br>skills/ 配下のみ"]

    style Parent fill:#e3f2fd
    style Coach fill:#e8f5e9
    style Researcher fill:#fff3e0
```

## スキルファイルの流れ（DCC-7）

スキルファイルはシステムプロンプトに目次だけ注入し、<br>中身は researcher が必要に応じて Read で読む。<br>調査結果は Write でスキルファイルに蓄積され、次回以降はローカルでヒットする。

```mermaid
flowchart LR
    subgraph skills ["skills/"]
        Tech["techniques/<br>gradients.md<br>masks.md<br>blend-modes.md<br>..."]
        Tools["tools/photoshop/<br>menu-structure.md<br>shortcuts.md<br>filters.md<br>..."]
    end

    Plan["Plan<br>steps[].application"]
    Plan -->|"buildSkillManifest()"| Manifest["目次文字列<br>- skills/techniques/gradients.md<br>- skills/tools/photoshop/filters.md<br>- ..."]

    Manifest -->|"システムプロンプトに注入"| SysPrompt["buildCoachSystemPrompt()"]

    Researcher["researcher"] -->|"Read（必要なものだけ）"| skills
    Researcher -->|"Write（蓄積）"| skills

    WebResult["Web検索結果<br>YouTube抽出結果"] --> Researcher

    style Manifest fill:#e8eaf6,stroke:#5c6bc0
```

## セキュリティガード（DCC-7）

researcher の Write / Bash をコードレベルで制限する `createResearcherPermissionGuard()`。

```mermaid
flowchart TD
    ToolCall["researcher がツールを呼ぶ"] --> Guard["createResearcherPermissionGuard()"]

    Guard --> CheckTool{ツール名？}

    CheckTool -->|Write| CheckPath{"file_path が<br>skills/ 配下？"}
    CheckPath -->|Yes| Allow1["allow ✅"]
    CheckPath -->|No| Deny1["deny ❌<br>skills/ 外への書き込み禁止"]

    CheckTool -->|Bash| ValidateCmd["validateBashCommand()"]
    ValidateCmd --> CheckMeta{"シェルメタ文字<br>; | & ` $ 等？"}
    CheckMeta -->|あり| Deny2["deny ❌"]
    CheckMeta -->|なし| CheckStructure{"bun run<br>src/extract-video.ts<br>+ YouTube URL？"}
    CheckStructure -->|Yes| Allow2["allow ✅"]
    CheckStructure -->|No| Deny3["deny ❌"]

    CheckTool -->|その他| Allow3["allow ✅"]
```

## 関連ドキュメント

- [プロジェクト思想](./memory/README.md) — 「隣に座っている先輩デザイナー」の考え方
- [ロードマップ](./roadmap/loadmap.md) — Phase 1-6 の開発計画
