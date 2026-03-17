# @dcc/server リーディングガイド

> 最終更新: 2026-03-17

## このパッケージの役割

`@dcc/server` は Hono + tRPC のWebサーバー。`@dcc/core` のドメインロジックを HTTP API として公開し、SQLite で状態を永続化する。mutable shell（副作用層）にあたる。

## ファイルマップ

```text
packages/server/src/
├── index.ts              ← サーバー起動エントリポイント
├── app.ts                ← Hono アプリ定義（tRPCマウント + 静的配信）
│
├── trpc/
│   ├── trpc.ts           ← tRPC 初期化（router, publicProcedure）
│   ├── context.ts        ← AppContext 型定義（全ルーター共通の依存注入）
│   ├── router.ts         ← 全ルーター統合 → AppRouter 型をexport
│   └── routers/
│       ├── plan.ts       ← プラン生成 mutation
│       ├── setup.ts      ← セッション開始 mutation
│       ├── session.ts    ← セッション一覧/詳細/復元
│       ├── display.ts    ← ディスプレイ一覧 query
│       ├── events.ts     ← SSE subscription（リアルタイムイベント配信）
│       └── debug.ts      ← 開発用デバッグAPI（本番では無効）
│
├── db/
│   ├── database.ts       ← SQLite + Drizzle ORM 初期化
│   ├── schema.ts         ← テーブル定義（sessions, plans, advices）
│   ├── sessions.ts       ← sessions テーブル操作
│   ├── plans.ts          ← plans テーブル操作 + JSON パース
│   └── advices.ts        ← advices テーブル操作
│
├── lib/
│   ├── coach-session.ts  ← [最重要] コーチングループのライフサイクル管理
│   ├── start-session.ts  ← セッション開始の共通ワークフロー
│   ├── image-store.ts    ← Base64画像のバリデーション・保存
│   └── logger.ts         ← タグ付きログユーティリティ
│
└── pure/
    ├── event-bus.ts      ← Pub/Sub イベント配信
    └── pending-plan-cache.ts ← プラン一時キャッシュ（TTL 30分）
```

### ディレクトリの設計意図

| ディレクトリ | 責務 | 副作用 |
|-------------|------|--------|
| `pure/` | 副作用なし。インメモリのデータ構造 | なし |
| `lib/` | core 呼出、DB書込、ファイルI/O | あり |
| `db/` | SQLite 操作。Drizzle ORM 経由 | あり |
| `trpc/` | HTTP API 定義。入力バリデーション | なし（ルーター自体は純粋） |

## 起動フロー

`bun run packages/server/src/index.ts` で何が起きるか。

```mermaid
sequenceDiagram
    participant index.ts
    participant Core as @dcc/core
    participant DB as database.ts
    participant App as app.ts
    participant Bun as Bun.serve

    index.ts->>Core: loadConfig(config.json)
    index.ts->>DB: createDatabase(dcc.sqlite)
    index.ts->>index.ts: createEventBus()
    index.ts->>index.ts: createPendingPlanCache()
    index.ts->>index.ts: createCoachSession({ config, eventBus, db })
    index.ts->>App: createApp({ createContext })
    App->>App: Hono + tRPC fetchRequestHandler
    App->>App: serveStatic（本番用静的ファイル）
    index.ts->>Bun: Bun.serve({ port: 3456, fetch: app.fetch })
```

**読むべきファイル**: `index.ts` → `app.ts` → `trpc/context.ts`

## AppContext: 全ルーターの共有依存

```mermaid
graph TD
    CTX["AppContext"]
    CTX --> DB["db: DrizzleDb"]
    CTX --> EB["eventBus: EventBus"]
    CTX --> CFG["config: CoachConfig"]
    CTX --> CS["coachSession: CoachSessionHandle"]
    CTX --> PPC["pendingPlanCache: PendingPlanCache"]

    R1["plan.ts"] -.->|ctx.pendingPlanCache| CTX
    R2["setup.ts"] -.->|ctx.db, ctx.coachSession| CTX
    R3["session.ts"] -.->|ctx.db, ctx.coachSession| CTX
    R4["events.ts"] -.->|ctx.eventBus| CTX
    R5["display.ts"] -.->|引数なし| CTX

    style CTX fill:#e1f5fe
```

`index.ts` で1回だけ生成され、全リクエストで共有されるシングルトン群。

## メインフロー1: プラン生成 → セッション開始

ユーザーのセットアップ操作で発生する一連のフロー。

```mermaid
sequenceDiagram
    participant C as Client
    participant P as plan.ts
    participant IS as image-store.ts
    participant Core as @dcc/core
    participant Cache as PendingPlanCache
    participant S as setup.ts
    participant SS as start-session.ts
    participant DB as db/*.ts
    participant CS as coach-session.ts
    participant Loop as @dcc/core coach-loop

    Note over C,P: Phase 1: プラン生成
    C->>P: plan.generate({ image, goal })
    P->>IS: saveBase64Image(base64, fileName)
    IS-->>P: { filePath }
    P->>Core: generatePlan({ imagePath, goal })
    Core-->>P: { plan }
    P->>Cache: cache.set(planId, { plan, imagePath, goal })
    P-->>C: { planId, plan }

    Note over C,S: Phase 2: セッション開始
    C->>S: setup.start({ displayId, displayName, planId })
    S->>Cache: cache.get(planId)
    Cache-->>S: { plan, imagePath, goal }
    S->>Cache: cache.delete(planId)
    S->>SS: startSession(deps, params)
    SS->>DB: insertSession()
    SS->>DB: insertPlan()
    SS->>CS: coachSession.start(options)
    CS->>Core: loadSkillManifest()
    CS->>Loop: startCoachLoop()
    Note over Loop: ループ開始（非同期で継続）
    SS-->>S: { sessionId }
    S-->>C: { sessionId }
```

**読むべきファイル**: `trpc/routers/plan.ts` → `trpc/routers/setup.ts` → `lib/start-session.ts` → `lib/coach-session.ts`

## メインフロー2: リアルタイムイベント配信（SSE）

コーチングループが動いている間のデータフロー。

```mermaid
flowchart LR
    subgraph "@dcc/core"
        CL["coach-loop\nonEvent(LoopEvent)"]
    end

    subgraph "lib/"
        CS["coach-session.ts\nイベントハンドラ"]
    end

    subgraph "pure/"
        EB["event-bus.ts\npublish()"]
    end

    subgraph "db/"
        ADV["advices.ts\ninsertAdvice()"]
        SESS["sessions.ts\nendSession()"]
    end

    subgraph "trpc/routers/"
        EV["events.ts\nsubscribe()"]
    end

    subgraph "Client"
        SSE["SSE 受信\nuseLoopEvents()"]
    end

    CL -->|"LoopEvent"| CS
    CS -->|"TaggedLoopEvent\n(+sessionId)"| EB
    CS -->|"advice のみ"| ADV
    EB -->|"sessionId フィルタ"| EV
    EV -->|"yield event"| SSE

    CL -->|"loopFinished"| CS
    CS -->|"stopped / error"| EB
    CS --> SESS

    style EB fill:#fff3e0
    style CS fill:#e8f5e9
```

**読むべきファイル**: `lib/coach-session.ts`（イベントハンドラ部分）→ `pure/event-bus.ts` → `trpc/routers/events.ts`

## メインフロー3: セッション復元

過去セッションの復元は `session.restore` → `startSession()` の共通パスを通る。

```mermaid
sequenceDiagram
    participant C as Client
    participant SR as session.ts (restore)
    participant DB as db/*.ts
    participant SS as start-session.ts

    C->>SR: session.restore({ id })
    SR->>DB: findSessionById(id)
    SR->>DB: findPlanBySessionId(id)
    SR->>DB: parsePlanRow() → Plan型
    SR->>SS: startSession(deps, { goal, plan, ... })
    Note over SS: insertSession + insertPlan + coachSession.start
    SS-->>SR: { sessionId }
    SR-->>C: { sessionId }
```

## DBスキーマ

```mermaid
erDiagram
    sessions {
        TEXT id PK
        TEXT goal
        TEXT reference_image_path
        TEXT display_id
        TEXT display_name
        TEXT started_at
        TEXT ended_at
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
        TEXT plan_id FK
        INTEGER round_index
        TEXT content
        INTEGER timestamp_ms
    }

    sessions ||--o{ plans : "1:N"
    sessions ||--o{ advices : "1:N"
    plans ||--o{ advices : "0:N"
```

- `plans.steps` は `PlanStep[]` のJSON文字列。`parsePlanRow()` / `parseStepsJson()` でデシリアライズ
- `advices` は coach-loop の `advice` イベント到着時に1行ずつ INSERT

## coach-session.ts: ライフサイクル管理

このファイルが server パッケージの心臓部。

```mermaid
stateDiagram-v2
    [*] --> Idle: createCoachSession()
    Idle --> Active: start(options)
    Active --> Active: start(options)\n前ループを abort して新ループ起動
    Active --> Idle: loopFinished\n(activeState をリセット)
    Active --> Idle: stop()\n(abort → loopFinished)
```

内部状態は `activeState: { sessionId, loop, abortController } | null` の単一オブジェクトで管理。

## 読む順番の推奨

1. **`index.ts`** — 起動で何が組み立てられるか
2. **`trpc/context.ts`** — 全ルーターに何が渡されるか
3. **`trpc/routers/plan.ts` → `setup.ts`** — メインのユーザーフロー
4. **`lib/coach-session.ts`** — ループ管理の仕組み
5. **`trpc/routers/events.ts` + `pure/event-bus.ts`** — SSEの仕組み
6. **`db/schema.ts`** — テーブル構造

`lib/image-store.ts`, `lib/logger.ts`, `pure/pending-plan-cache.ts`, `db/sessions.ts` 等は必要なときに参照すれば十分。
