# DCC-02: プロジェクト初期セットアップ

## 概要

Adobe CC AI Coach の開発基盤を構築する。package.json, tsconfig.json, ディレクトリ構成の作成と依存パッケージのインストールを行う。

## 設計判断

### pngjs → sharp への統合

loadmap.md では pixelmatch + pngjs の構成だったが、**pngjs は Bun で動作しない**（`zlib.writeSync` 未実装: [bun#13846](https://github.com/oven-sh/bun/issues/13846)）。

sharp は PNG の読み書きが可能で、raw pixel buffer を出力できる。pixelmatch は raw pixel buffer を受け取るため、sharp → pixelmatch の直接連携で pngjs が不要になる。依存が減りシンプルになる。

### node-screenshots の Bun 互換性

napi-rs ベースのネイティブアドオン。Bun の N-API 互換率は 98% だが、node-screenshots 固有の検証報告はない。`bun install` 後に動作確認を行い、動かない場合は `screenshot-desktop` または OS コマンド直接呼び出しにフォールバックする。

## 実装ステップ

### Step 1: package.json の作成

```json
{
  "name": "dcc-support",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch run src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "node-screenshots": "^0.2.8",
    "pixelmatch": "^7.0.0",
    "sharp": "^0.34.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.8.0"
  }
}
```

変更点（loadmap.md からの差分）:
- pngjs を削除（sharp で代替）
- node-notifier は Phase 5 で追加するため今は含めない
- `"type": "module"` で ES Modules を使用

### Step 2: tsconfig.json の作成

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Bun 固有の設定:
- `"types": ["bun-types"]` で Bun のグローバル型（Bun.serve, Bun.spawn 等）を有効化
- `"module": "ESNext"` + `"moduleResolution": "bundler"` が Bun 推奨の設定
- `"verbatimModuleSyntax": true` で import/export の型消去を明示的に制御

### Step 3: ディレクトリ構成の作成

```
dcc_suport/
├── src/
│   ├── index.ts           # エントリポイント（placeholder）
│   ├── config.ts          # 設定管理・型定義（placeholder）
│   ├── capture.ts         # スクリーンキャプチャ（placeholder）
│   ├── diff.ts            # ピクセル差分検知（placeholder）
│   ├── engine.ts          # Claude Code CLI呼び出し（placeholder）
│   └── prompts.ts         # プロンプト定義（placeholder）
├── skills/                # アプリ固有スキルファイル（後で作成）
├── sessions/              # コーチングセッション保存先
├── config.json            # ユーザー設定
├── package.json
├── tsconfig.json
├── .gitignore
├── CLAUDE.md
├── README.md
└── docs/
```

loadmap.md との差分:
- `agents.ts`, `planner.ts`, `coach-loop.ts`, `notify.ts`, `dashboard.ts`, `dashboard.html` は後続issueで作成
- `hooks/` ディレクトリは DCC-08 で作成
- `mcp.json` はオプション機能のため今は作成しない

各 placeholder ファイルの内容:

```typescript
// src/index.ts
console.log("dcc-support: Adobe CC AI Coach");
```

```typescript
// src/config.ts
export type CoachConfig = {
  readonly intervalSeconds: number;
  readonly diffThresholdPercent: number;
  readonly maxImageWidth: number;
  readonly dashboard: {
    readonly isEnabled: boolean;
    readonly port: number;
  };
};

export const defaultConfig: CoachConfig = {
  intervalSeconds: 5,
  diffThresholdPercent: 5,
  maxImageWidth: 1280,
  dashboard: {
    isEnabled: true,
    port: 3456,
  },
};
```

他の placeholder は export のない空ファイル（コメントで責務のみ記載）。

### Step 4: config.json の作成

```json
{
  "intervalSeconds": 5,
  "diffThresholdPercent": 5,
  "maxImageWidth": 1280,
  "dashboard": {
    "isEnabled": true,
    "port": 3456
  }
}
```

loadmap.md の設定から `engine`, `claude` セクションは後続issueで追加。

### Step 5: .gitignore の作成

```
node_modules/
dist/
sessions/
*.log
.DS_Store
.work/
```

### Step 6: 依存パッケージのインストールと動作確認

```bash
bun install
```

インストール後の確認:
1. `bun run typecheck` で TypeScript のコンパイルエラーがないことを確認
2. `bun run start` で "dcc-support: Adobe CC AI Coach" が出力されることを確認
3. node-screenshots の実動作確認（import だけでなく実呼び出しまで検証する）:
   - `Monitor.all()` でウィンドウ一覧が取得できるか
   - 任意のウィンドウに対して `.captureImage()` で1枚キャプチャが取れるか
   - 取得した画像バッファが sharp で読み込めるか

node-screenshots が実呼び出しで失敗する場合:
- エラー内容を記録し、以下のフォールバック順で対応する:
  1. `screenshot-desktop`（外部コマンドラッパー）に切り替え
  2. OS コマンド直接呼び出し（macOS: `screencapture`, Linux: `scrot`）を `Bun.spawn` で実行
- フォールバック結果を DCC-04 の issue に追記する

## 整合性チェック結果

このissueは純粋なプロジェクトスキャフォールディングであり、Frontend/Backend の分離は発生しない。

チェック済み項目:
- [x] loadmap.md の技術スタックとの整合性
- [x] CLAUDE.md のルール（bun使用、class禁止、不変データ）との整合性
- [x] coderule.md RULE-002（命名に単位を含める: `intervalSeconds`, `diffThresholdPercent`）
- [x] coderule.md RULE-008（変数の PascalCase 禁止: `CoachConfig` は型なので OK）
- [x] pngjs の Bun 非互換への対処（sharp で代替）
- [x] 後続 issue との依存関係に矛盾がないか
