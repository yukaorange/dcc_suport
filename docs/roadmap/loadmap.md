# Adobe CC AI Coach — プロジェクト仕様書

## 概要

Adobe CC（Illustrator / Photoshop / After Effects）でグラフィック制作中、AIが画面を自律的に監視し、制作の方針に沿ったコーチングをリアルタイムで行うCLIツール。

**AIは操作しない。横で見ていて、方針判断・手順ノウハウ・具体的なGUI操作の指示を出す。**

リファレンス画像の完コピが目的ではない。リファレンスは「こういう方向性でやりたい」の共有手段であり、ユーザーが自分のクリエイティブを作り上げる過程をAIがコーチとして支援する。

---

## コーチが提供する3つの価値

1. **方針判断** — 「その方向で合ってる」「もっとコントラスト効かせた方がいい」
2. **手順・ノウハウ** — 「次はクリッピングマスクを使うといい。やり方は…」（知らないことはWeb検索して教える）
3. **GUI操作の具体指示** — 「レイヤーパネルで右クリック → クリッピングマスクを作成」

---

## 動作フロー

### フェーズ1: プランニング（手動・対話）

1. ユーザーがツールを起動
2. リファレンス画像のファイルパスを指定
3. やりたいこと・目指す方向性をテキストで記述
4. リファレンス分析 + リサーチ
   a. coachがリファレンス画像を分析し、表現の特徴を言語化
      （「多層グラデーション」「リムライト」「ノイズテクスチャ」等のキーワード抽出）
   b. researcherが多段探索で表現技法をリサーチ（プランニングリサーチ）
      - expressions/スキルファイルに関連する知識がないか検索
      - なければブログ記事・YouTube動画から技法を調査
   c. coachがリサーチ結果 + ユーザーの意図を統合して制作方針とプランを生成
      - **各ステップで使用するアプリの選定を含む**（例: Step 1-3はIllustrator、Step 4以降はPhotoshop）
      - 表現技法の性質からどのアプリが最適かを判断する（ベクター作業→Illustrator、テクスチャ加工→Photoshop等）
5. ユーザーがプランを確認・修正・合意
6. 起動中のウィンドウ一覧から監視対象を選択（監視は常に1アプリ。プランの進行でアプリが変わる場合はユーザーが切り替える）
7. 「作業開始」で自律監視ループに入る
8. **プログレスダッシュボード**がブラウザで開く

### フェーズ2: 自律コーチング（自動・AIプッシュ）

```md
5秒ごとのループ:
  ① 対象ウィンドウのスクリーンショットを取得
  ② 前回画像とのピクセル差分を算出（ローカル処理）
  ③ 閾値以下 → なにもしない
  ④ 閾値以上 →
     Claude Code CLIを呼び出し（セッション継続）:
       入力:
         - 現在のスクリーンショット
         - プラン + これまでの指示履歴（セッション内で保持）
         - （リファレンス画像は初回セッションで渡し済み）
         - （アプリ固有スキルファイルはシステムプロンプトに注入済み）
       AI構成（サブエージェント）:
         - coach: 画面を見て方針判断・進捗評価
         - researcher: 多段探索で知識を調査（スキルファイル→ブログ→YouTube/Gemini）
       coachが判断:
         a. 方針に沿って進んでいるか
         b. 今アドバイスすべきか、黙るべきか
         c. 次のステップに未知の表現技法が含まれるか
            → YES: researcherにプランニングリサーチを依頼 → プランにサブステップを追加
         d. アドバイスするなら:
            - 方針フィードバック
            - 次にやるべきことの手順
            - 具体的なGUI操作（スキルファイルの知識を活用）
            - 操作手順が不明ならresearcherにオペレーションリサーチを依頼
  ⑤ アドバイスがあれば出力（ターミナル / OS通知）
  ⑥ プログレスダッシュボードを更新（プラン追加があれば反映）
```

### コーチングの具体例

#### プランニング段階（フェーズ1: researcherがプランニングリサーチに参加）

```md
ユーザー: 「このリファレンスみたいな、奥行きのあるグラデーション背景を作りたい」
         [リファレンス画像を添付]

AI(coach): リファレンスを分析 → キーワード抽出
  「多層グラデーション」「色温度の変化（暖→寒）」「ガウスぼかしでなじませ」

AI(coach→researcher): 「depth gradient」「多層グラデーション 奥行き」で技法リサーチ
AI(researcher):
  1. skills/expressions/gradient/depth-gradient.md → ヒット！
     「多層グラデーション + 描画モード + ぼかしの組み合わせ」の知見を返却
  2. 不足する具体パラメータをブログ記事から補足

AI(coach): リサーチ結果 + リファレンス分析 + ユーザーの意図を統合
  → プラン生成（表現の原理を踏まえた、根拠のあるステップ分解 + アプリ選定）:
  方針: ベクターでベースを作り、ラスターでテクスチャと空気感を重ねる
  Step 1: [Illustrator] ベースシェイプをベクターで構築
  Step 2: [Illustrator] グラデーションメッシュで基本の色面を作る
  Step 3: [Photoshop] PSD書き出し → 多層グラデーションを重ねる（描画モード:オーバーレイ）
  Step 4: [Photoshop] ぼかし（ガウス）で層の境界をなじませる
  Step 5: [Photoshop] 微調整
```

#### コーチング段階（フェーズ2: 作業中にリサーチサイクルが回る）

```md
--- 作業開始 ---

[ユーザーがグラデーションを引く]
AI(coach): 「ベースグラデーションいい感じ。次は新しいレイヤーを作って、
     暖色系のグラデーションを重ねましょう。
     レイヤーパネル下部の＋アイコンで新規レイヤー作成、
     グラデーションツール（G）で左上から右下に引いてください」
→ ダッシュボード: Step 1 ✅ → Step 2 🔄

[ユーザーが描画モードを変えずにグラデーションを引く]
AI(coach): 「グラデーション引けましたね。ただこのままだと下が見えない。
     レイヤーパネルで描画モードを『通常』から『オーバーレイ』に
     変えてください。ドロップダウンがレイヤーパネルの左上にあります」

--- 作業中のリサーチサイクル（プランニングリサーチの再発動） ---

[Step 3完了。ユーザーが「ここにハーフトーンっぽいテクスチャも入れたい」と相談]
AI(coach): 次のステップにハーフトーン表現が必要 → プランにない技法を検知
AI(coach→researcher): 「ハーフトーン テクスチャ」で表現技法をリサーチ
AI(researcher):
  1. skills/expressions/texture/ を検索 → 該当なし
  2. ブログ記事を検索 → 「ハーフトーンパターンの作り方」を取得
     → skills/expressions/texture/halftone-pattern.md に蓄積
AI(coach): リサーチ結果をもとにプランにStep 4a〜4cを追加
  「ハーフトーンを重ねるとレトロ感が出ていいですね。手順としては:
   4a. 新規レイヤーでグレーのベタ塗り
   4b. フィルター > ピクセレート > カラーハーフトーン
   4c. 描画モードを乗算に変えて不透明度を調整」
→ ダッシュボード: Step 4a〜4c が追加される

--- オペレーションリサーチ（操作手順の調査） ---

[ユーザーが長時間止まっている]
AI(coach→researcher): カラーハーフトーンのメニュー位置を確認
AI(researcher): skills/tools/photoshop/filters.md を検索 → ヒットしなければWeb検索で確認
AI(coach): 「カラーハーフトーンの場所は
     メニュー > フィルター > ピクセレート > カラーハーフトーン です。
     最大半径は8〜12pxくらいから試してみてください」
```

---

## サブエージェント構成

### coach（判断役）

画面を見て方針判断・進捗評価に集中する。スキルファイルの知識を活用して、具体的なGUI操作指示を出す。プランニング時には表現技法の性質から最適なアプリを選定し、アプリ間の制作フロー（Illustrator→Photoshop等）を設計する。

```json
{
  "coach": {
    "description": "Adobe CCの操作コーチ。画面を見て方針判断と次の操作を指示する",
    "prompt": "（コーチモードのシステムプロンプト。スキルファイルの内容を含む）",
    "model": "sonnet"
  }
}
```

### researcher（調査役）

researcherは2つの役割を持つ。

1. **プランニングリサーチ**: ユーザーの意図とリファレンスから、実現に必要な表現技法を調査する。coachが抽出したキーワードをもとに、expressions/スキルファイルを優先的に検索し、プランの質を高める。フェーズ1の初期プラン生成時だけでなく、フェーズ2の作業中に新たな表現技法が必要になった場合にも再発動する。
2. **オペレーションリサーチ**: コーチング中にcoachが確信を持てないツール操作を調査する。tools/スキルファイルを優先的に検索し、具体的なGUI操作手順を提供する。

多段探索フロー自体はどちらの役割でも同じだが、検索対象が異なる:

- プランニングリサーチ: expressions/（表現技法）を優先的に検索
- オペレーションリサーチ: tools/（ツール操作）を優先的に検索

#### 多段探索フロー

researcherは以下の優先順位で情報を探索する。上位で見つかれば下位は実行しない。

```
1. スキルファイル検索（Read）
   └─ ヒット → そのまま返却
   └─ ミス ↓

2. ブログ記事のWebFetch（WebSearch + WebFetch）
   └─ ヒット → 構造化して返却 + スキルファイルに蓄積
   └─ 不十分 ↓

3. YouTube動画 → Gemini API（WebSearch + Bash）
   └─ 字幕で事前フィルタリング → 有望な動画をGemini 2.5 Flashで構造化抽出
   └─ 結果をスキルファイルに蓄積
```

#### 各段階のコスト・速度比較

| 段階 | コスト | 速度 | 精度 | 備考 |
|------|--------|------|------|------|
| 1. スキルファイル | 0（ローカルRead） | 最速（<1秒） | 高（過去に検証済み） | 蓄積量に依存 |
| 2. ブログ記事 | 低（Claude内で完結） | 速い（数秒） | 中〜高 | テキストベースで抽出しやすい |
| 3. YouTube + Gemini | 中（外部API呼び出し） | 遅い（10-30秒） | 高（動画は情報密度が高い） | Gemini無料枠に制約あり |

#### Gemini API呼び出し仕様

- **モデル**: Gemini 2.5 Flash（無料枠）
- **用途**: YouTube動画の構造化抽出に限定
- **無料枠制約**: 1日あたり約8時間分の動画処理、5-15 RPM
- **パッケージ**: `@google/genai`
- **呼び出し方**: researcherがBashツール経由で `bun run` スクリプトを実行

#### 蓄積サイクル

Geminiやブログから取得した知識はスキルファイルに蓄積される。次回以降、同じ知識が必要になったとき段階1で即座にヒットするため、外部APIへの依存が徐々に減少する自立型設計。

```json
{
  "researcher": {
    "description": "Adobe CCの表現技法と操作手順を多段探索で調査する。プランニング時は表現技法（expressions/）、コーチング時はツール操作（tools/）を優先的に検索する",
    "prompt": "あなたは2つの役割を持つリサーチャーです。(1) プランニングリサーチ: リファレンス分析から表現技法を調査する場合、まずskills/expressions/を検索してください。(2) オペレーションリサーチ: ツール操作を調査する場合、まずskills/tools/を検索してください。いずれの場合も、スキルファイルで見つからなければブログ記事をWebFetch、それでも不十分ならYouTube動画をGemini APIで構造化抽出してください。取得した知識はスキルファイルに蓄積してください。",
    "tools": ["WebSearch", "WebFetch", "Read", "Write", "Bash"]
  }
}
```

### 分離のメリット

- coachの応答速度が上がる（毎回Web検索しない）
- 役割が明確でプロンプトが書きやすい
- researcherの呼び出し頻度はスキルファイルの充実度で減らせる

### 検証事項

- `-p` モードでサブエージェント（`--agents`）が動作するか要検証
- 動作しない場合、システムプロンプト内でcoach/researcher的な役割切り替えを指示する代替策

---

## スキルファイル（知識ベース）

### 目的

AIが正確なコーチングを行うには、2種類の知識が必要になる。

1. **表現の知識** — 「奥行きのあるグラデーション」を実現するにはどんな色彩理論・構図・エフェクトの組み合わせが有効か
2. **ツールの知識** — その表現をPhotoshopで実現するにはどのメニュー・パネル・ショートカットを使うか

この2層を分離することで、ツールに依存しない表現知識の再利用と、ツール固有の操作手順の正確性を両立する。

### 2層構造: expressions / tools

```md
skills/
├── expressions/          # 表現・ビジュアル知識（ツール非依存）
│   ├── gradient/
│   │   ├── depth-gradient.md       # 奥行きのあるグラデーション背景
│   │   └── metallic-gradient.md    # メタリックなグラデーション表現
│   ├── texture/
│   │   ├── paper-texture.md        # 紙のテクスチャ表現
│   │   └── noise-grain.md          # ノイズ・グレイン効果
│   ├── lighting/
│   │   ├── rim-light.md            # リムライト表現
│   │   └── ambient-occlusion.md    # 環境遮蔽の表現
│   └── composition/
│       └── visual-hierarchy.md     # 視覚的階層の作り方
│
└── tools/                # ツール固有の操作手順
    ├── photoshop/
    │   ├── menu-structure.md       # メニュー階層、パネル一覧
    │   ├── shortcuts.md            # 主要ショートカット
    │   ├── layer-operations.md     # レイヤー操作（マスク、描画モード等）
    │   └── filters.md              # フィルター操作（ぼかし、シャープ等）
    ├── illustrator/
    │   ├── menu-structure.md
    │   ├── shortcuts.md
    │   └── path-operations.md      # パス操作（ペンツール、パスファインダー等）
    └── aftereffects/
        ├── menu-structure.md
        ├── shortcuts.md
        └── keyframe-operations.md  # キーフレーム・エフェクト操作
```

### 粒度の方針

スキルファイルの単位は「何を」ではなく **「何のために・どんな場面で」** で切る。

- NG: `blur.md`（ぼかし全般） → 範囲が広すぎて検索性が低い
- OK: `depth-gradient.md`（奥行きのあるグラデーション背景） → ユースケース単位で、coachが「この場面だ」と判断しやすい

### expressionsファイルの構造例

```markdown
# 奥行きのあるグラデーション背景

## ユースケース
ポスター・バナーの背景に、単調でない空気感のあるグラデーションを作りたい場面。

## 表現の原理
- 多層グラデーション: 2-3色のグラデーションを複数レイヤーで重ねる
- 描画モードの活用: オーバーレイやソフトライトで色を混ぜる
- ぼかしの適用: 層の境界をなじませて空気遠近法的な効果を出す
- 色温度の変化: 手前を暖色、奥を寒色にすると奥行き感が強まる

## 推奨パラメータ
- グラデーション角度: 対角線方向（左上→右下）が自然
- ぼかし半径: 15-25px（全体サイズ比5-10%）
- 重ねるレイヤー数: 2-3層（多すぎると濁る）
```

### toolsファイルの構造例

```markdown
# Photoshop CC 2025 — フィルター操作

## ぼかし（ガウス）
- メニュー: フィルター > ぼかし > ぼかし（ガウス）
- パラメータ: 半径（px単位）、プレビューチェックボックス

## アンシャープマスク
- メニュー: フィルター > シャープ > アンシャープマスク
- パラメータ: 量、半径、しきい値
```

### 注入方法

```bash
# expressionsから関連するファイル + 対象アプリのtoolsを注入
claude -c -p "..." \
  --append-system-prompt "$(cat skills/expressions/gradient/depth-gradient.md skills/tools/photoshop/filters.md skills/tools/photoshop/layer-operations.md)"
```

コーチングセッション開始時に、プランの内容から関連するexpressionsファイルを選定し、対象アプリのtoolsファイルと合わせて注入する。

### 蓄積サイクル

researcherの多段探索で取得した知識は、以下のサイクルでスキルファイルに蓄積される。

```
初回: coachが「奥行きのあるグラデーション」を聞かれる
  → skills/expressions/ に該当ファイルなし
  → researcher がブログ/YouTubeから知識を取得
  → skills/expressions/gradient/depth-gradient.md に蓄積
  → skills/tools/photoshop/filters.md にぼかし操作を追記

2回目以降: 同じ表現が必要になったとき
  → skills/expressions/ から即座にヒット（Gemini/Web検索不要）
  → コスト0・最速で回答可能
```

使うほどスキルファイルが育ち、外部API（Gemini / Web検索）への依存が自然に減少する自立型設計。

### 効果

- Web検索・Gemini APIへの依存度が使用とともに減少 → 応答速度向上・コスト削減
- 表現知識がツール非依存 → Photoshopで蓄積した表現知識をIllustratorでも再利用可能
- GUI操作指示の正確性が向上（toolsファイルにメニューパス・ショートカットを網羅）
- スキルファイルはコミュニティで共有・改善可能

---

## Claude Code Hooks活用

Hooksは5秒ループのコーチング本体には使わない（定期ポーリングはHooksの設計思想と合わない）。補助的な以下の用途で活用する。

### Stop hook — コーチング履歴の保存

セッション終了時に、コーチング履歴（プラン進捗、アドバイス履歴）をファイルに自動保存する。

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "node ./hooks/save-session.js",
        "async": true
      }]
    }]
  }
}
```

### Notification hook — OS通知への転送

Claude Codeの通知イベントをOS通知に転送する。

```json
{
  "hooks": {
    "Notification": [{
      "hooks": [{
        "type": "command",
        "command": "node ./hooks/notify.js"
      }]
    }]
  }
}
```

### SessionStart hook — 前回状態の復元

セッション再開時に、前回のコーチング状態（プラン、進捗、直前のアドバイス）を自動的にコンテキストに注入する。

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "node ./hooks/restore-session.js"
      }]
    }]
  }
}
```

### 検証事項

- `-p` モードでHooksが発火するか要検証
- Hooks設定ファイルの配置場所（`.claude/settings.json` or プロジェクトローカル）

---

## プログレスダッシュボード

### 目的

ターミナル出力だけだとコーチング履歴が流れていく。ブラウザで開ける簡易ダッシュボードでプランの進捗を可視化する。

### 表示内容

```
┌───────────────────────────────────────────┐
│  Adobe CC AI Coach — Progress Dashboard   │
│                                           │
│  対象: Photoshop CC 2025                  │
│  リファレンス: [サムネイル表示]             │
│                                           │
│  ─── プラン進捗 ───                       │
│  Step 1: ベースシェイプ      [✅ 完了]     │
│  Step 2: パス調整            [✅ 完了]     │
│  Step 3: 着色                [🔄 作業中]   │
│  Step 4: グラデーション       [⬜ 未着手]   │
│  Step 5: エフェクト           [⬜ 未着手]   │
│                                           │
│  ─── 最新アドバイス ───                   │
│  「描画モードをオーバーレイに変えて        │
│   ください。ドロップダウンがレイヤー       │
│   パネルの左上にあります」                │
│                                           │
│  ─── アドバイス履歴 ───                   │
│  15:32 Step 2完了、Step 3へ               │
│  15:28 パスのアンカーポイント追加を指示    │
│  15:25 ベースシェイプ完了を確認            │
│  15:20 コーチングセッション開始            │
└───────────────────────────────────────────┘
```

### 技術実装

- **Bun.serve()** でlocalhostにHTTPサーバーを起動（数十行）
- 単一HTMLファイル + インラインJS/CSS
- コーチングループから状態更新 → WebSocket or SSE でリアルタイム反映
- ブラウザでタブを1つ開いておくだけ

```typescript
// 最小実装イメージ
Bun.serve({
  port: 3456,
  fetch(req) {
    if (req.url.endsWith('/events')) {
      // SSE エンドポイント
      return new Response(sseStream, {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    }
    return new Response(dashboardHTML, {
      headers: { 'Content-Type': 'text/html' }
    })
  }
})
```

### ダッシュボードの起動

コーチングセッション開始時に自動的に `http://localhost:3456` を開く。終了時にサーバーも停止。

---

## AI呼び出し方式

### Claude Code CLI（サブプロセス呼び出し）

- **月額サブスク枠内で動作。API従量課金なし**
- `claude -c -p "..."` でパイプモード＋セッション継続
- `--mcp-config ./mcp.json` でMCPサーバー接続（オプション）
- `--append-system-prompt "..."` でコーチモード + スキルファイル注入
- `--output-format json` で結果をパース可能な形式で受け取る
- `--allowedTools` でツール許可を事前設定
- `--agents` でサブエージェント（coach / researcher）を定義

### セッション継続

`-c` フラグで直前の会話を継続する。これにより:

- リファレンス画像とプランの文脈が保持される
- 「さっきStep 2を案内した → 次はStep 3」という流れをAIが覚えている
- 過去の指示を踏まえた判断ができる（同じことを繰り返し言わない）

### Web検索

researcherサブエージェントの多段探索の第2段階。coachが確信を持てない操作手順について、ブログ記事をWebFetchで取得・構造化する。Claude Code内で完結するため追加コストはかからない。

### Gemini API連携（YouTube動画の構造化抽出）

researcherの多段探索の第3段階として、YouTube動画の内容をGemini APIで構造化抽出する。

- **位置づけ**: Claude Code CLIと併用する外部API。Claude Codeの中からBashツール経由で呼び出す
- **用途**: YouTube動画の構造化抽出に限定（汎用的なAI処理には使わない）
- **モデル**: Gemini 2.5 Flash（無料枠）
- **無料枠の仕様**: 1日あたり約8時間分の動画処理、5-15 RPM
- **パッケージ**: `@google/genai`（Google公式SDK）
- **フォールバック策**:
  1. 無料枠超過時 → Web版Geminiで手動処理
  2. API障害時 → ブログ記事のみで対応（精度は下がるが動作は継続）

```typescript
// Gemini呼び出しの最小イメージ（researcherがBash経由で実行）
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        { text: "この動画からAdobe Photoshopの操作手順を構造化して抽出してください" },
        { fileData: { fileUri: videoUri, mimeType: "video/mp4" } }
      ]
    }
  ]
});
```

### 将来のモデル切り替え（今は実装しない）

アダプター層を設けて、Claude Code以外のCLI（OpenAI Codex等）にも切り替え可能にする構想はあるが、初期実装ではClaude Code固定。

---

## 介入判断ロジック（システムプロンプトでAIに指示）

| 状況 | AIの判断 | 理由 |
|---|---|---|
| 作業の途中（シェイプ描画中など） | 黙る | 完成前に口を出すと邪魔 |
| 前回の指示を実行中 | 黙る | やってる最中に次を言わない |
| 画面にほぼ変化なし | 黙る | まだ作業途中 |
| 1ステップが完了した | 次を案内 | 自然な切り替わりポイント |
| 方針から逸脱している | 軌道修正 | 「こっちの方向がいいかも」 |
| 明らかな操作ミス | 即指摘 | レイヤー間違い等 |
| 長時間変化なし（困ってる？） | 声かけ | 手順がわからず止まってる可能性 |

この判断はシステムプロンプトで定義する。ローカルでルールエンジンを実装するわけではない。

---

## 技術スタック

### ランタイム

- **TypeScript + Bun** （TSを直接実行、コンパイル不要）

### ライブラリ

| 機能 | パッケージ | 用途 |
|---|---|---|
| スクリーンキャプチャ | **screenshot-desktop** | Win/Mac/Linux対応、OS標準コマンドのラッパー、Promise API |
| ピクセル差分検知 | **pixelmatch** + **pngjs** | 前回画像との変化検知（トリガー用途のみ） |
| 画像リサイズ | **sharp** | トークン節約のためキャプチャを縮小 |
| OS通知 | **node-notifier** | Win/Mac/Linux統一API |
| CLI呼び出し | **child_process**（標準） | Claude Code CLIをサブプロセスで呼ぶ |
| HTTPサーバー | **Bun.serve()**（標準） | プログレスダッシュボード |
| 設定ファイル | JSON | config.json |

### pixelmatchの役割

pixelmatchは**トリガーとしてのみ使用**する。

- 前回スクショと今回スクショの差分率を算出
- 閾値を超えたらAIを呼ぶ。超えなければスキップ
- 差分ヒートマップ生成、色抽出、エリア分析は行わない

### クロスプラットフォーム要件

- **macOS固有のコマンドに依存しない**
- Windows / macOS / Linuxで同じ手順で動作する
- `npm install` → `bun run start` で起動

---

## ディレクトリ構成

```
adobe-coach/
├── src/
│   ├── index.ts           # エントリポイント
│   ├── config.ts          # 設定管理・型定義
│   ├── capture.ts         # スクリーンキャプチャ（screenshot-desktop）
│   ├── diff.ts            # ピクセル差分検知 - トリガー用途のみ（pixelmatch）
│   ├── engine.ts          # Claude Code CLI呼び出し抽象層
│   ├── agents.ts          # サブエージェント定義（coach / researcher）
│   ├── planner.ts         # プラン生成・管理・進捗追跡
│   ├── coach-loop.ts      # 自律監視ループ
│   ├── notify.ts          # 通知出力（ターミナル / OS通知）
│   ├── dashboard.ts       # プログレスダッシュボード（Bun.serve + SSE）
│   ├── dashboard.html     # ダッシュボードUI（単一HTMLファイル）
│   └── prompts.ts         # システムプロンプト定義（コーチモード + 介入判断ロジック）
├── skills/
│   ├── expressions/       # 表現・ビジュアル知識（ツール非依存）
│   │   ├── gradient/      # グラデーション系
│   │   ├── texture/       # テクスチャ系
│   │   ├── lighting/      # ライティング系
│   │   └── composition/   # 構図・レイアウト系
│   └── tools/             # ツール固有の操作手順
│       ├── photoshop/     # Photoshop CC
│       ├── illustrator/   # Illustrator CC
│       └── aftereffects/  # After Effects CC
├── hooks/
│   ├── save-session.ts    # Stop hook: セッション履歴保存
│   ├── restore-session.ts # SessionStart hook: 前回状態復元
│   └── notify.ts          # Notification hook: OS通知転送
├── sessions/              # 保存されたコーチングセッション
├── config.json            # ユーザー設定
├── mcp.json               # MCP設定（オプション）
├── package.json
├── tsconfig.json
└── README.md
```

---

## 設定ファイル（config.json）

```json
{
  "engine": "claude",
  "interval": 5,
  "threshold": 5,
  "maxImageWidthPx": 1280,
  "notification": "terminal",
  "dashboard": {
    "enabled": true,
    "port": 3456
  },
  "claude": {
    "mcpConfig": "./mcp.json",
    "systemPromptAppend": true,
    "useSubagents": true
  }
}
```

---

## コスト最適化設計

1. **ローカル差分検知**: 変化がない間はAIを呼ばない → コストゼロ
2. **画像リサイズ**: 1280px幅に縮小 → トークン消費を抑制
3. **AI呼び出し**: 意味のある変化があったときだけ
4. **セッション継続**: リファレンスとプランを毎回送り直さない
5. **スキルファイル**: Web検索の頻度を減らす → 応答速度向上 + トークン節約
6. **サブエージェント分離**: coachは軽い判断に集中、researcherは必要時のみ起動
7. **サブスク枠内**: API従量課金なし

---

## MCP統合（オプション）

### adb-mcp（Adobe MCP）

なくてもコーチングは成立する。上級者向けオプション。

**方針: コアループはスクリーンショットのみで完結させ、adb-mcpは後から追加可能な設計にする。**

---

## 未確定・要検証事項

1. **`claude -p` で画像ファイルパスを読めるか**
   - Claude Codeのインタラクティブモードではファイルパス参照で画像が読める
   - `-p` モードで同様に動くか手元で検証が必要

2. **`-c -p` の同時使用でセッション継続が機能するか**
   - コンテキストウィンドウの蓄積で長時間セッションが切れる可能性

3. **`-p` モードで `--agents` が動作するか**
   - サブエージェント構成が非インタラクティブモードで使えるか

4. **`-p` モードでHooksが発火するか**
   - 特にStop / SessionStart

5. **Claude CodeのWeb検索ツール**
   - `-p` モードでresearcherサブエージェントがWeb検索できるか

6. **プランのデータ構造**
   - AIが生成するプランのJSONフォーマット
   - ダッシュボードの進捗表示に必要なフィールド定義

7. **サブスクのレート制限**
   - Claude Code CLIの頻繁な呼び出しでProプランの制限に当たるか

---

## 開発優先順位

### Phase 1: 最小動作検証

- [ ] screenshot-desktopでディスプレイ一覧表示＋キャプチャが動くことを確認
- [ ] pixelmatchで差分検知が動くことを確認
- [ ] `claude -c -p` で画像ファイルパスを渡して応答が返ることを確認
- [ ] `--agents` フラグが `-p` モードで動作するか確認
- [ ] 上記を組み合わせた最小ループの動作確認

### Phase 2: コアループ実装

- [ ] 設定ファイル読み込み
- [ ] ウィンドウ選択UI（ターミナル上でのインタラクティブ選択）
- [ ] リファレンス画像指定＋目標記述 → プラン生成
- [ ] 自律監視ループ
- [ ] システムプロンプト（コーチモード＋介入判断ロジック）
- [ ] ターミナル出力のフォーマット

### Phase 3: スキルファイル＋サブエージェント＋Gemini連携

- [ ] スキルファイル2層構造（expressions / tools）のディレクトリ構築
- [ ] Photoshop / Illustrator / After Effects のtoolsスキルファイル初期作成
- [ ] expressionsスキルファイルのサンプル作成（gradient, texture等）
- [ ] スキルファイルのシステムプロンプト注入（expressions + tools結合）
- [ ] coach / researcher サブエージェント定義
- [ ] researcherの多段探索フロー実装（スキルファイル → ブログ → YouTube）
- [ ] Gemini 2.5 Flash API接続検証（`@google/genai` + 無料枠動作確認）
- [ ] YouTube動画 → Gemini構造化抽出 → スキルファイル蓄積パイプラインの実装
- [ ] researcherのWeb検索動作確認

### Phase 4: ダッシュボード＋Hooks

- [ ] Bun.serve() でダッシュボード起動
- [ ] SSEでリアルタイム更新
- [ ] プラン進捗の可視化
- [ ] アドバイス履歴表示
- [ ] Stop hook（セッション保存）
- [ ] SessionStart hook（状態復元）
- [ ] Notification hook（OS通知転送）

### Phase 5: 体験改善

- [ ] プランの永続化・セッション再開
- [ ] エラーハンドリング・リトライ
- [ ] OS通知（node-notifier）

### Phase 6: 拡張（オプション）

- [ ] adb-mcp統合（Photoshop優先）
- [ ] モデル切り替え（Codex等）のアダプター層
- [ ] デスクトップアプリ化（Electron / Tauri）— DCC全画面使用時にオーバーレイウィンドウとしてコーチングUIを常時表示
- [ ] README・セットアップドキュメント
