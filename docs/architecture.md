# アーキテクチャ概要

更新日: 2026-03-19

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
        Coach["advisor<br>方向性判断・GUI案内"]:::dcc7
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
        skills["skills.ts<br>─────────────<br>buildSkillManifest()<br>loadSkillManifest()<br>createToolPermissionGuard()"]:::new
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

### テストカバレッジ

#### @dcc/core（vitest）

| モジュール | テスト | ファイル / 理由 |
|-----------|--------|----------------|
| config.ts | あり | test/config.test.ts |
| list-displays.ts | あり | test/list-displays.test.ts |
| planner.ts | あり | test/planner.test.ts |
| coach-loop.ts | あり | test/coach-loop.test.ts（統合テスト、モック使用） |
| capture.ts | あり | test/capture.test.ts |
| diff.ts | あり | test/diff.test.ts |
| prompts.ts | あり | test/prompts.test.ts |
| engine.ts | あり | test/engine.test.ts |
| skills.ts | あり | test/skills.test.ts |
| agents.ts | あり | test/agents.test.ts |
| gemini.ts | あり | test/gemini.test.ts（APIキー未設定・URL不正の異常系のみ） |
| output.ts | なし | 純粋な表示ロジック（console.log のみの副作用） |
| extract-video.ts | なし | CLIエントリポイント（gemini.ts を呼ぶだけ） |
| index.ts | なし | エントリポイント（各モジュールの組み合わせのみ） |

手動検証スクリプト群: `src/verify/`（11ファイル）。SDK連携やストリーミング動作を実環境で検証。

#### @dcc/server（bun:test）

| モジュール | テスト | ファイル / 理由 |
|-----------|--------|----------------|
| db/sessions.ts | あり | test/db.test.ts（CRUD + パージ） |
| db/plans.ts | あり | test/db.test.ts（CRUD + ステップ更新） |
| db/advices.ts | あり | test/db.test.ts（CRUD + 復元コピー） |

#### @dcc/cli（vitest）

| モジュール | テスト | ファイル / 理由 |
|-----------|--------|----------------|
| setup-flow.ts | あり | test/setup-flow.test.ts（キャンセル動作） |

#### E2E テスト（Playwright）

| テスト | ファイル / 内容 |
|--------|----------------|
| セットアップフロー | e2e/（Chromium、サーバー + クライアント自動起動） |

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

## エージェント構成（DCC-7）

### 全体像：親エージェントとサブエージェントの関係

Claude Agent SDK では、AI は「ツール」を通じてテキスト生成以外のアクション（ファイル読み書き・Web検索・コマンド実行等）を行う。
本プロジェクトでは、親エージェントが直接ツールを使わず、目的別のサブエージェントに委譲する構成を取っている。

```mermaid
flowchart TD
    subgraph assembly ["組み立て（coach-loop.ts L260-281）"]
        direction LR
        A1["agents:<br>buildAgentDefinitions()"]
        A2["tools: 'Agent'"]
        A3["canUseTool:<br>createToolPermissionGuard()"]
    end

    assembly -->|"invokeClaude() に渡す"| Engine["engine.ts<br>buildQueryOptions()"]
    Engine -->|"queryOptions にそのまま詰め替え"| SDK["Claude Agent SDK<br>query()"]

    SDK --> Parent

    subgraph runtime ["SDK 内部の実行時構造"]
        Parent["親エージェント<br>───────────<br>使えるツール: Agent のみ<br>（＝サブエージェントを呼ぶだけ）"]

        Parent -->|"方向性判断が必要"| Advisor["advisor<br>───────────<br>tools: なし（対話のみ）<br>方向性・美的判断<br>GUI操作案内<br>進捗評価"]

        Parent -->|"調査が必要"| Researcher["researcher<br>───────────<br>tools: WebSearch, WebFetch,<br>Read, Write, Bash, Glob<br>（canUseTool の検問あり）"]
    end

    style assembly fill:#f5f5f5,stroke:#bdbdbd
    style runtime fill:#e3f2fd,stroke:#90caf9
    style Advisor fill:#e8f5e9
    style Researcher fill:#fff3e0
```

### 3つの設定プロパティの役割

`invokeClaude()` に渡す3つのプロパティが、エージェントの権限構造を決定する。

| プロパティ | 担当関数 | 定義場所 | 役割 |
|-----------|---------|---------|------|
| `agents` | `buildAgentDefinitions()` | agents.ts | **誰を呼べるか**：サブエージェントの名簿。名前・説明・プロンプト・使えるツール一覧を定義 |
| `tools` | — (リテラル) | coach-loop.ts | **セッション全体のツール一覧**：親・サブエージェント含め、このセッションで利用可能な全ツール。ここに含まれないツールはサブエージェントにも渡されない |
| `allowedTools` | — (リテラル) | coach-loop.ts | **親が直接使えるツール**：`tools` のサブセット。親エージェント（advisor）自身が自動承認で使えるツールを制限する |
| `canUseTool` | `createToolPermissionGuard()` | skills.ts | **使い方が安全か**：ツール実行の直前に毎回呼ばれるコールバック。引数の内容を見て allow / deny を返す |

```mermaid
flowchart LR
    subgraph agents_prop ["agents（誰を呼べるか）"]
        Def["buildAgentDefinitions()<br>agents.ts"]
        Def --> Advisor2["advisor<br>tools: なし"]
        Def --> Researcher2["researcher<br>tools: Read,Write,<br>Bash,Glob,<br>WebSearch,WebFetch"]
    end

    subgraph tools_prop ["tools（セッション全体のツール一覧）"]
        Tools2["tools: Agent, Read, Write,<br>Bash, Glob, WebSearch, WebFetch<br>coach-loop.ts"]
        Tools2 --> Menu["ここに含まれないツールは<br>サブエージェントにも渡されない"]
    end

    subgraph allowed_prop ["allowedTools（親が直接使えるツール）"]
        Allowed["allowedTools: Read, Agent<br>coach-loop.ts"]
        Allowed --> Restrict["advisor 自身は Read と<br>Agent のみ使用可能"]
    end

    subgraph canuse_prop ["canUseTool（使い方が安全か）"]
        Guard2["createToolPermissionGuard()<br>skills.ts"]
        Guard2 --> Check["ツール実行の直前に<br>毎回コールバックされ<br>allow / deny を返す"]
    end
```

#### tools と allowedTools の違い（重要）

更新日: 2026-03-30

`tools` と `allowedTools` は似ているが役割が異なる。混同するとサブエージェントがツールを使えなくなる。

| プロパティ | スコープ | 役割 |
|-----------|---------|------|
| `tools` | セッション全体（親 + サブエージェント） | このセッションで「存在を認識する」ツールの一覧。ここにないツールは誰も使えない |
| `allowedTools` | 親エージェントのみ | `tools` のうち、親が自動承認で直接使えるものを制限する |

```
tools: ["Read", "Agent", "WebSearch", "WebFetch", "Write", "Bash", "Glob"]
                 ↑ セッション全体のメニュー（全員が見える）

allowedTools: ["Read", "Agent"]
                 ↑ advisor が自分で注文できるもの（advisor の制限）
```

**実例**: researcher が Bash で `extract-video.ts` を実行するには、parent の `tools` に `"Bash"` が含まれている必要がある。`allowedTools` に含まれていなくても、サブエージェントの agent 定義で `tools: ["Bash"]` と指定されていれば researcher は使える。

### 注意: createToolPermissionGuard() が実質 researcher にのみ影響する理由

`createToolPermissionGuard()` は SDK レベルでは**全エージェント共通**のコールバックとして登録される。
しかし、このコールバックが発火するのは「ツールを実行しようとした瞬間」のみであるため、
ツールを持たないエージェントには判定が走る機会自体がない。

```mermaid
flowchart LR
    subgraph parent ["親エージェント"]
        PT["allowedTools: Read, Agent"]
        PT --> PA["Agent ツールで<br>サブエージェントを呼ぶ"]
        PA -.- PG["canUseTool?<br>→ Agent の実行に対しては<br>SDK が呼ばない"]
    end

    subgraph advisor_box ["advisor"]
        AT["tools: なし"]
        AT --> AA["テキスト生成のみ<br>ツール呼び出しなし"]
        AA -.- AG["canUseTool?<br>→ 発火する機会がない"]
    end

    subgraph researcher_box ["researcher"]
        RT["tools: Read, Write,<br>Bash, Glob,<br>WebSearch, WebFetch"]
        RT --> RA["ツールを使うたびに<br>canUseTool が発火"]
        RA --> RG["createToolPermissionGuard()<br>が allow / deny を判定"]
    end

    style PG fill:#f5f5f5,stroke:#bdbdbd,stroke-dasharray: 5 5
    style AG fill:#f5f5f5,stroke:#bdbdbd,stroke-dasharray: 5 5
    style RG fill:#fff3e0,stroke:#ff9800
```

| エージェント | tools | canUseTool が発火するか | 理由 |
|-------------|-------|----------------------|------|
| 親 | `allowedTools: ["Read", "Agent"]` | しない | SDK は Agent ツール（サブエージェント呼び出し）に対して canUseTool を呼ばない |
| advisor | なし | しない | ツールを一切持たないので、判定を受ける機会がない |
| researcher | 6つ | **する** | Read / Write / Bash 等を使うたびに毎回判定される |

結果として、`createToolPermissionGuard()` 内の判定ロジック（skills/ 配下のみ書き込み可、Bash は extract-video.ts のみ等）は**事実上 researcher のためのルール**となっている。
関数名を `createToolPermissionGuard` としているのは、これが SDK の `canUseTool` コールバックとして全体に登録される仕組みであることを正確に表すためである。

### ツール実行時の二重チェック

サブエージェントがツールを使おうとしたとき、2段階のチェックが走る。

```mermaid
sequenceDiagram
    participant R as researcher
    participant SDK as Claude Agent SDK
    participant CUT as canUseTool<br>(permissionGuard)
    participant Tool as 実際のツール<br>(Read, Write等)

    R->>SDK: Read("skills/masks.md") を使いたい

    Note over SDK: チェック①<br>researcher の tools に<br>"Read" が含まれるか？
    SDK->>SDK: ✅ tools に "Read" あり

    Note over SDK: チェック②<br>canUseTool に問い合わせ
    SDK->>CUT: canUseTool("Read", {file_path: "skills/masks.md"})
    CUT->>CUT: skills/ 配下か判定
    CUT-->>SDK: { behavior: "allow" }

    SDK->>Tool: Read 実行
    Tool-->>R: ファイル内容を返す

    Note over R,Tool: ──── 拒否される例 ────

    R->>SDK: Read("src/index.ts") を使いたい
    SDK->>SDK: ✅ tools に "Read" あり
    SDK->>CUT: canUseTool("Read", {file_path: "src/index.ts"})
    CUT->>CUT: skills/ でも docs/ でもない
    CUT-->>SDK: { behavior: "deny" }
    SDK-->>R: ❌ ブロック
```

### canUseTool の判定ルール一覧

`createToolPermissionGuard()` (skills.ts) が返すコールバック関数の判定ルール。

```mermaid
flowchart TD
    ToolCall["ツール呼び出し"] --> Switch{ツール名？}

    Switch -->|"Read / Glob"| ReadCheck["checkReadPermission()"]
    ReadCheck --> ReadPath{"パスが skills/ または<br>docs/ 配下か？"}
    ReadPath -->|Yes| RA["allow ✅"]
    ReadPath -->|No| RD["deny ❌"]

    Switch -->|Write| WriteCheck["checkWritePermission()"]
    WriteCheck --> WritePath{"パスが skills/ 配下か？<br>（sep 付きプレフィクス一致）"}
    WritePath -->|Yes| WA["allow ✅"]
    WritePath -->|No| WD["deny ❌"]

    Switch -->|Bash| BashCheck["checkBashPermission()<br>→ validateBashCommand()"]
    BashCheck --> Meta{"シェルメタ文字<br>; | & ` $ 等？"}
    Meta -->|あり| BD1["deny ❌"]
    Meta -->|なし| Structure{"bun run<br>src/extract-video.ts<br>[YouTube URL]？"}
    Structure -->|Yes| BA["allow ✅"]
    Structure -->|No| BD2["deny ❌"]

    Switch -->|"WebSearch / WebFetch"| WEB["allow ✅<br>（無条件）"]

    Switch -->|"その他（Edit等）"| DEFAULT["deny ❌<br>（未知のツールは全拒否）"]
```

### スキルファイルの流れ

スキルファイルはシステムプロンプトに**目次（ファイルパス一覧）だけ**注入し、<br>中身は researcher が必要に応じて Read で読む。<br>調査結果は Write でスキルファイルに蓄積され、次回以降はローカルでヒットする。

```mermaid
flowchart LR
    subgraph skills ["skills/"]
        Tech["techniques/<br>gradients.md<br>masks.md<br>blend-modes.md<br>..."]
        Tools["tools/photoshop/<br>menu-structure.md<br>shortcuts.md<br>filters.md<br>..."]
    end

    Plan["Plan<br>steps[].application"]
    Plan -->|"loadSkillManifest()<br>→ buildSkillManifest()"| Manifest["目次文字列<br>- skills/techniques/gradients.md<br>- skills/tools/photoshop/filters.md<br>- ..."]

    Manifest -->|"buildCoachSystemPrompt() で<br>skill-reference-data タグに格納"| SysPrompt["システムプロンプト"]

    SysPrompt --> Parent2["親エージェント<br>（目次を見て researcher に指示）"]
    Parent2 --> Researcher3["researcher"]

    Researcher3 -->|"Read（必要なものだけ）"| skills
    Researcher3 -->|"Write（蓄積）"| skills

    WebResult["Web検索結果<br>YouTube抽出結果"] --> Researcher3

    style Manifest fill:#e8eaf6,stroke:#5c6bc0
```

## DCC-8: モノレポ構成 + プログレスダッシュボード + セッション管理

更新日: 2026-03-19

DCC-8 では CLIセットアップをブラウザGUIに置き換え、プログレスダッシュボードとセッション永続化を追加する。
既存コードをモノレポに再構成し、4つのパッケージに分離する。

### パッケージ構成

```mermaid
graph TD
    subgraph packages ["packages/"]
        Core["@dcc/core<br>───────────<br>共有ドメインロジック<br>coach-loop, planner,<br>engine, config 等"]
        Server["@dcc/server<br>───────────<br>Hono + tRPC + DB<br>API層, EventBus,<br>セッション管理"]
        Client["@dcc/client<br>───────────<br>React SPA<br>Vite, TanStack Query"]
        CLI["@dcc/cli<br>───────────<br>CLI版エントリ<br>inquirer"]
    end

    CLI -->|"workspace:*"| Core
    Server -->|"workspace:*"| Core
    Client -.->|"型のみ参照<br>AppRouter"| Server

    style Core fill:#e8f5e9
    style Server fill:#e3f2fd
    style Client fill:#fff3e0
    style CLI fill:#f5f5f5
```

### 技術スタック（DCC-8 追加分）

| 領域 | 技術 | 役割 |
|------|------|------|
| モノレポ | Bun workspaces | パッケージ分離 |
| サーバー | Hono | 軽量Webフレームワーク。Bun.serve() で起動 |
| API | tRPC v11 | 型安全なRPC。Hono fetchアダプタ経由 |
| リアルタイム | tRPC subscription (SSE) | サーバー→ブラウザの一方向ストリーム |
| フロントエンド | React 19 + Vite | SPA。開発時はVite proxy経由でHonoと通信 |
| 状態管理 | TanStack Query | tRPC React統合でサーバー状態を管理 |
| DB | bun:sqlite (WALモード) | セッション・プラン・アドバイス履歴の永続化 |

### 全体フロー（GUI版 / DCC-8）

```mermaid
flowchart TD
    Start([bun run start:web]) --> LoadConfig["@dcc/core<br>loadConfig()"]
    LoadConfig --> InitDB["@dcc/server<br>createDatabase()"]
    InitDB --> StartHono["Hono + tRPC<br>localhost:3456"]

    subgraph browser ["ブラウザ（React SPA）"]
        SetupUI["セットアップUI<br>ディスプレイ選択<br>リファレンス画像D&D<br>目標入力"]
        PlanReview["プラン確認<br>承認 / 再生成"]
        Dashboard["ダッシュボード<br>プラン進捗<br>アドバイス履歴"]
        SessionList["セッション一覧<br>過去セッション閲覧<br>復元"]
    end

    StartHono --> SetupUI
    SetupUI -->|"tRPC mutation<br>plan.generate"| GenPlan["@dcc/core<br>generatePlan()"]
    GenPlan --> PlanReview
    PlanReview -->|"tRPC mutation<br>setup.start"| StartLoop

    StartLoop["@dcc/server<br>coach-session.ts<br>startCoachLoop()"]:::dcc8

    subgraph loop ["コーチングループ（既存・変更なし）"]
        Capture["captureScreen()"]
        Diff["computeDiff()"]
        Engine["invokeClaude()"]
    end

    StartLoop --> Capture

    subgraph eventflow ["イベント配信"]
        EventBus["EventBus<br>(TaggedLoopEvent)"]:::dcc8
        SSE["tRPC subscription<br>(SSE)"]:::dcc8
        DB["bun:sqlite<br>INSERT advice"]:::dcc8
    end

    Engine -->|"onEvent()"| EventBus
    EventBus -->|"sessionIdフィルタ"| SSE
    SSE -->|"リアルタイム"| Dashboard
    EventBus --> DB

    SessionList -->|"tRPC query<br>session.list"| DB
    Dashboard -->|"tRPC query<br>session.get"| DB

    classDef dcc8 fill:#e8eaf6,stroke:#5c6bc0
```

### パッケージ間の依存と型の流れ

```mermaid
flowchart LR
    subgraph core ["@dcc/core"]
        Types["Plan, LoopEvent,<br>CoachAdvice,<br>CoachConfig 等"]
    end

    subgraph server ["@dcc/server"]
        Router["AppRouter<br>(tRPCルーター)"]
        TaggedEvent["TaggedLoopEvent<br>= LoopEvent &<br>{ sessionId }"]
    end

    subgraph client ["@dcc/client"]
        TrpcClient["tRPCクライアント<br>createTRPCReact&lt;AppRouter&gt;()"]
    end

    core -->|"import { Plan, ... }"| server
    server -->|"export type AppRouter"| client
    core -.->|"型はtRPC経由で<br>自動伝搬"| client

    style core fill:#e8f5e9
    style server fill:#e3f2fd
    style client fill:#fff3e0
```

### SSE データフロー

```mermaid
sequenceDiagram
    participant Loop as coach-loop<br>(@dcc/core)
    participant Session as coach-session<br>(@dcc/server)
    participant Bus as EventBus
    participant Sub as tRPC subscription
    participant UI as ブラウザ

    Loop->>Session: onEvent({ kind: "advice", ... })
    Session->>Bus: publish({ ...event, sessionId })
    Session->>Session: INSERT INTO advices

    Bus->>Sub: listener 呼び出し（sessionId フィルタ）
    Sub-->>UI: SSE data: { kind: "advice", ... }
    UI->>UI: useState で adviceHistory に追加

    Note over Loop,UI: 5秒後、次のラウンドへ...
```

### DBスキーマ

```mermaid
erDiagram
    sessions ||--o{ plans : "has"
    sessions ||--o{ advices : "has"
    plans ||--o{ advices : "references"

    sessions {
        TEXT id PK
        TEXT goal
        TEXT reference_image_path
        TEXT display_id
        TEXT display_name "default=''"
        TEXT started_at
        TEXT ended_at "NULLなら進行中"
    }

    plans {
        TEXT id PK
        TEXT session_id FK
        TEXT goal
        TEXT reference_summary
        TEXT steps "JSON: PlanStep[]"
        TEXT created_at
    }

    advices {
        TEXT id PK
        TEXT session_id FK
        TEXT plan_id FK "nullable"
        INTEGER round_index
        TEXT content
        INTEGER timestamp_ms
        INTEGER is_restored "default=0, 復元されたアドバイスか"
    }
```

#### インデックス

- `idx_plans_session` — plans.session_id
- `idx_advices_session` — advices.session_id

### セットアップフローの変化

| 項目 | CLI版（DCC-6） | GUI版（DCC-8） |
|------|---------------|---------------|
| ディスプレイ選択 | inquirer select | `<select>` ドロップダウン |
| リファレンス画像 | パス手入力 | D&D / ファイル選択 + プレビュー |
| 目標入力 | inquirer input | `<textarea>` |
| プラン確認 | ターミナル表示 + Y/N | カード表示 + 承認/再生成ボタン |
| アドバイス表示 | ターミナル出力 | ダッシュボード（リアルタイム） |
| ユーザーメッセージ送信 | stdin入力 | メッセージ入力バー（⌘+Enter） |
| セッション履歴 | なし | SQLite永続化 + 一覧/復元UI |
| セッション復元 | なし | 過去セッションのアドバイス履歴を引き継いで新セッション作成 |
| セッションパージ | なし | 200件超の古いセッションを自動削除（画像ファイル含む） |

### CLI版との共存

```text
bun run start      → packages/cli/src/index.ts    → @dcc/core（既存動作を維持）
bun run start:web  → packages/server/src/index.ts  → @dcc/core + Hono + tRPC + DB
```

コアロジック（`@dcc/core`）は両方から共有。CLI版は一切変更なし。

## @dcc/server パッケージ内部構成

```mermaid
flowchart LR
    subgraph trpc ["tRPC ルーター (src/trpc/)"]
        Router["appRouter"]
        Session["sessionRouter<br>list / get / sendMessage / restore"]
        Plan["planRouter<br>generate"]
        Setup["setupRouter<br>start"]
        Display["displayRouter<br>list"]
        Events["eventsRouter<br>subscribe (SSE)"]
        Debug["debugRouter<br>ping / ctx / activeSession / dbStatus / log<br>（dev環境のみ）"]
    end

    subgraph lib ["アプリケーション層 (src/lib/)"]
        CoachSession["coach-session.ts<br>createCoachSession()"]
        StartSession["start-session.ts<br>startSession() / schedulePurge()"]
        ImageStore["image-store.ts<br>saveBase64Image()"]
        Logger["logger.ts<br>createTaggedLogger()"]
    end

    subgraph pure ["純粋ロジック (src/pure/)"]
        EventBus["event-bus.ts<br>createEventBus()"]
        PlanCache["pending-plan-cache.ts<br>createPendingPlanCache()<br>TTL: 30分"]
    end

    subgraph db ["データアクセス (src/db/)"]
        Database["database.ts<br>createDatabase()"]
        Sessions["sessions.ts<br>CRUD + purge"]
        Plans["plans.ts<br>CRUD + stepStatus更新"]
        Advices["advices.ts<br>CRUD + copyAdvicesToSession()"]
    end

    Router --> Session & Plan & Setup & Display & Events & Debug
    Setup --> CoachSession & StartSession & PlanCache
    Session --> CoachSession & db
    Plan --> PlanCache & ImageStore
    Events --> EventBus
    CoachSession --> EventBus & db
    StartSession --> db

    style trpc fill:#e3f2fd
    style lib fill:#fff3e0
    style pure fill:#e8f5e9
    style db fill:#f3e5f5
```

### tRPC プロシージャ一覧

| ルーター | プロシージャ | 種類 | 役割 |
|---------|------------|------|------|
| session | list | query | セッション一覧（プランステップ数付き） |
| session | get | query | セッション詳細（プラン + アドバイス履歴） |
| session | sendMessage | mutation | アクティブセッションへユーザーメッセージ送信 |
| session | restore | mutation | 過去セッションのアドバイス履歴を引き継いで新セッション作成 |
| plan | generate | mutation | リファレンス画像 + 目標からプラン生成 |
| setup | start | mutation | キャッシュ済みプランでセッション開始 |
| display | list | query | 接続ディスプレイ一覧 |
| events | subscribe | subscription | SSE でリアルタイムイベント配信（sessionId フィルタ） |

## セッション復元フロー

過去のセッションからアドバイス履歴を引き継いで新セッションを作成する機能。

```mermaid
sequenceDiagram
    participant UI as ブラウザ
    participant API as session.restore
    participant DB as SQLite

    UI->>API: restore({ sourceSessionId })
    API->>DB: findSessionById(sourceId)
    API->>DB: findPlanBySessionId(sourceId)
    API->>DB: insertSession(新セッション)
    API->>DB: insertPlan(プランコピー)
    API->>DB: copyAdvicesToSession(sourceId → targetId)
    Note over DB: isRestored=1 でコピー
    API->>API: schedulePurge(db, newSessionId)
    API-->>UI: { sessionId: 新ID }
    UI->>UI: ダッシュボードに遷移
    Note over UI: 復元アドバイスは「前回」バッジで表示
```

## セッションパージ

セッション数が 200 を超えた場合、古いセッションを自動削除する。`setup.start` と `session.restore` の完了後に `setImmediate` で非同期実行される。

- 現在のセッションは除外
- カスケード削除: advices → plans → sessions
- 関連する画像ファイルも削除（他セッションと共有していないもののみ）

## ユーザーメッセージ送信フロー

ダッシュボードからコーチに質問を送る機能。

```mermaid
sequenceDiagram
    participant UI as MessageInput
    participant API as session.sendMessage
    participant CS as CoachSession
    participant Loop as Coーチングループ

    UI->>API: sendMessage({ sessionId, content })
    API->>CS: submitMessage(sessionId, content)
    CS->>Loop: loop.submitMessage(content)
    Note over Loop: MessageBox にバッファ<br>→ sleep を中断<br>→ diff スキップで即座に AI 呼び出し
    Loop-->>CS: onEvent({ kind: "advice", ... })
    CS-->>UI: SSE で配信
```

## CI/CD（GitHub Actions）

`.github/workflows/check.yml` で push 時に 3 つのジョブを並列実行。

| ジョブ | コマンド | 内容 |
|--------|---------|------|
| TypeCheck | `bun run typecheck` | 全パッケージの TypeScript 型検査 |
| Lint & Format | `bunx biome ci .` | Biome によるコード品質チェック |
| Unit Tests | `bun run test` | vitest（core/cli）+ bun:test（server） |

## @dcc/client ページ構成

クライアントは React 19 + Vite の SPA で、3 つのフェーズを状態マシンで管理する。

```mermaid
stateDiagram-v2
    [*] --> setup
    setup --> coaching : onCoachingStarted
    setup --> sessions : onNavigateToSessions
    coaching --> sessions : onNavigateToSessions
    coaching --> setup : onBackToSetup
    sessions --> setup : onNavigateToSetup
    sessions --> coaching : onRestore
```

| フェーズ | ページ | 主なコンポーネント |
|---------|-------|------------------|
| setup | SetupPage | DisplaySelector, ReferenceUploader, GoalInput, PlanReview |
| coaching | DashboardPage | LatestAdvice, PlanProgress, AdviceTimeline, MessageInput |
| sessions | SessionListPage / SessionDetailPage | セッション一覧, 復元ボタン, 過去アドバイス閲覧 |

### SSE サブスクリプション

`useLoopEvents` カスタムフックが `trpc.events.subscribe` を購読し、リアルタイムでダッシュボードを更新する。

| イベント種別 | 処理 |
|------------|------|
| advice | adviceHistory に追加 |
| plan_step_updated | プランステップの status を更新 |
| stopped | コーチング終了表示 |

## 関連ドキュメント

- [プロジェクト思想](./memory/README.md) — 「隣に座っている先輩デザイナー」の考え方
- [ロードマップ](./roadmap/loadmap.md) — Phase 1-6 の開発計画
