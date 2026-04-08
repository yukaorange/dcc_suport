# Superluminal Stardust — After Effects パーティクルプラグイン

## 概要

ノードベースのモジュラー3Dパーティクルシステム。ノードをドラッグ＆接続してパーティクルフローを構築する。最小構成は **Emitter → Particle** の2ノード。

## 重要: ノードの接続ルール

### グローバルノード（接続不要で全パーティクルに影響）

- **Force** — 重力・風などの物理力。グラフ上に置くだけで全パーティクルに作用する
- **Turbulence / Noise** — ノイズベースの揺らぎ。同様にグローバル

### 接続が必要なノード

- **Emitter → Particle** — 最小構成。Emitterが粒子を生成し、Particleが見た目を定義
- **Auxiliary** — 他のパーティクルからパーティクルを放出する（チェーン接続が必要）

### 接続位置による挙動の違い

- Force を **Emitter と Particle の間に接続** した場合 → パーティクルの**誕生時**のプロパティに影響（例: 誕生位置のディスプレイスメント）
- Force を **接続せずグラフ上に配置** した場合 → パーティクルの**ライフタイム全体**に影響（例: 継続的な重力や風）

## ノード一覧

### Emitter（エミッター）

パーティクルの発生源。

| パラメータ | 説明 | 推奨値（浮遊パーティクル用） |
|---|---|---|
| Type | 発生形状: Point / Sphere / Box / Layer / Light / Path | Sphere or Box |
| Particles Per Second | 毎秒の発生数 | 5〜20（控えめな演出） |
| Origin XY | エミッター中心の座標（コンプ座標系） | 指輪の中心に合わせる |
| Speed | パーティクルの初速 | 0（その場に留まらせる場合） |
| Speed Random | 速度のランダム幅 | — |
| Speed Over Life | ライフタイムに沿った速度変化 | — |
| Size X / Y / Z | エミッター形状のサイズ（発生範囲） | 600〜800 / 400〜500（シーン全体に散らす） |
| Angle X / Y / Z | 発射方向の角度 | — |
| Orient X / Y / Z | エミッターの向き | — |
| Direction | 発射方向のモード: Uniform / Directional | Uniform |
| Direction Span | 方向のばらつき範囲 | — |
| Life (Seconds) | パーティクルの寿命 | 3〜5秒 |
| Life Random | 寿命のランダム幅 | 0〜2 |
| Origin Time Sample | — | Normal |
| Time Offset (Frames) | 時間のオフセット | — |
| Random Seed | 乱数シード | — |
| Shift Seed | シードのシフト | — |
| Birth Chance | パーティクルが実際に生まれる確率（%） | 100 |

### Particle（パーティクル）

パーティクルの見た目を定義。

| パラメータ | 説明 | 推奨値 |
|---|---|---|
| Shape | Circle / Star / Sphere(3D) / Cube(3D) / Custom | Circle（2D光粒子） |
| Life (Seconds) | ※Emitter側で設定 | — |
| Size (Pixels) | パーティクルの大きさ | 2〜5（微細な光粒子） |
| Size Random | サイズのランダム幅 | 1〜2 |
| Color | パーティクルの色 | ゴールド #FFCC66 |
| Color Gradient | グラデーションで色変化させる場合 | — |
| Opacity | 不透明度 | 80〜100 |
| Opacity Random | 不透明度のランダム幅 | — |
| Particle Color | Solid Color / Layer 等 | Solid Color |
| Particle Feather | エッジの柔らかさ | 50〜100（光っぽくする） |
| Ignore Perspective | 遠近感を無視するか | — |
| Transfer Mode | 描画モード（パーティクル同士の合成） | Normal or Add |
| Up Axis | 上方向の軸 | — |
| **Over Life セクション** | | |
| Opacity over Life | 寿命に沿った不透明度カーブ | 0→100→0（フェードイン→アウト） |
| Size over Life | 寿命に沿ったサイズカーブ | — |
| Color over Life | 寿命に沿った色変化 | — |
| **Shadow Properties** | 影の設定 | — |
| **Cloud Properties** | クラウドレンダリング | — |
| **Path Properties** | パスに沿った動き | — |

### Force（フォース）

物理力を適用。**グラフ上に配置するだけで全パーティクルに影響する（接続不要）**。

| パラメータ | 説明 | 推奨値 |
|---|---|---|
| Gravity | 重力（マイナスで上方向） | -5〜-15（ゆっくり上昇） |
| Gravity Random | 重力のランダム幅 | 0〜5 |
| Gravity Over Life | ライフタイムに沿った重力変化 | — |
| Wind X | X方向の風 | 0 |
| Wind Y | Y方向の風 | 0 |
| Wind Z | Z方向の風 | 0 |
| Spin Frequency | 回転頻度 | — |
| Spin Seed | 回転の乱数シード | — |
| Air Density | 空気抵抗 | 0〜20（高いとゆっくり減速） |

### Turbulence / Noise（タービュレンス）

スムーズノイズで粒子を揺らす。**グローバルに作用する**。

| パラメータ | 説明 | 推奨値 |
|---|---|---|
| Amount | 揺らぎの強さ | 20〜50 |
| Scale | ノイズのスケール（大きいほど滑らか） | 200〜400 |
| Speed | ノイズの変化速度 | 0.3〜0.5 |
| Complexity | ノイズの複雑さ | — |

### Field（フィールド）

空間変形。パーティクルの位置・スケール等を操作するデフォーマー。

- Sphere / Box / 3D Model / Bend / Twist / Map / Black Hole 等のタイプがある

### Auxiliary（オグジリアリー）

他のパーティクルシステムからパーティクルを放出する。チェーン接続が必要。

- トレイル（軌跡）エフェクトに使える

### Replica（レプリカ）

パーティクルシステムを複製・配列する。

### Shader（シェーダー）

シェーディングを制御する。

### Model（モデル）

3Dモデルをパーティクルとして使用する。OBJ読み込み対応。

### Material（マテリアル）

3Dモデルのマテリアルを定義。

### Deformer（デフォーマー）

3Dモデルを変形する。

### Null（ヌル）

パーティクルシステム全体を移動するための空ノード。

## レイヤー設定

| 設定 | 推奨値 | 理由 |
|---|---|---|
| 描画モード | Screen または Add | 黒背景が透明になり、光の粒子だけが加算される |
| 不透明度 | 60〜100%（Screenの場合） | Screenは加算より柔らかいので高めでも品がある |

## よくあるレシピ

### 浮遊するゴールドダスト

- Emitter: Sphere, Speed 0, Size X/Y 大きめ, PPS 10〜15
- Particle: Circle, Size 2〜4, Color #FFCC66, Feather 50+, Opacity over Life 0→100→0
- Force: Gravity -10（ゆっくり上昇）, Air Density 10
- Turbulence: Amount 30, Scale 300, Speed 0.4
- レイヤー: Screen モード

### スパーク / 火花

- Emitter: Point, Speed 300+, PPS 50+
- Particle: Star, Size 3〜8, Color #FFaa33
- Force: Gravity 20（下方向）
- レイヤー: Add モード

## 参考リンク

- [公式ユーザーガイド](https://superluminal.tv/user-guide)
- [公式チュートリアル一覧](https://superluminal.tv/tutorials)
- [Turbulence Field チュートリアル](https://aescripts.com/learn/stardust-tutorial--turbulence-field--after-effects-/)
- [Golden Particle チュートリアル](https://aescripts.com/learn/post/create-a-golden-particle-title-intro-using-stardust-in-after-effects)
