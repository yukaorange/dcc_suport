# コーチングループ

> 作成日: 2026-03-06

## 概要

Adobe CC で作業中のユーザーの画面を 5 秒間隔で監視し、AI が制作アドバイスを提供する最小構成のコーチングループ。ループ中もユーザーが stdin からいつでも AI に話しかけられる双方向チャンネルを持つ。

## メインループフロー

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

## 双方向チャンネル（MessageBox パターン）

ユーザーが stdin から入力したメッセージを MessageBox にバッファし、ループ側の sleep を中断して即座に AI を呼び出す仕組み。

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

## AI の判断パターン

AI は毎ラウンド「喋るか黙るか」を自律的に判断する。

```mermaid
flowchart LR
    Input[画面 + 文脈] --> Judge{AI の判断}

    Judge -->|アドバイスあり| Text["テキスト応答 → ターミナルに表示"]
    Judge -->|静観すべき| Silent["__SILENT__ → 何も表示しない"]
    Judge -->|声かけ| Encourage["テキスト応答 → ターミナルに表示"]

    UserMsg[ユーザーメッセージ<br>がある場合] -->|__SILENT__ 禁止| MustRespond["必ずテキストで応答"]
```

## 3-case プロンプト分岐

AI に送るユーザープロンプトは状況に応じて 3 パターンに分岐する。嘘のない文脈を提供するための設計。

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

## グレースフルシャットダウン

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

## モジュール依存関係

```mermaid
flowchart TD
    Index["index.ts<br>（エントリポイント）"] --> CoachLoop["coach-loop.ts<br>（ループ本体）"]
    Index --> Output["output.ts<br>（ターミナル出力）"]

    CoachLoop --> Capture["capture.ts<br>（画面キャプチャ）"]
    CoachLoop --> DiffMod["diff.ts<br>（差分検知）"]
    CoachLoop --> Engine["engine.ts<br>（Claude API）"]
    CoachLoop --> Prompts["prompts.ts<br>（プロンプト生成）"]
    CoachLoop --> Config["config.ts<br>（設定）"]

    Index -.->|"onEvent コールバック"| CoachLoop

    style Index fill:#e8f5e9
    style CoachLoop fill:#e3f2fd
    style Output fill:#fff3e0
    style Capture fill:#f3e5f5
    style DiffMod fill:#f3e5f5
    style Engine fill:#f3e5f5
    style Prompts fill:#fff3e0
    style Config fill:#fafafa
```

## 関連

- [capture-diff モジュール](./capture-diff.md) — キャプチャリングと差分検知
