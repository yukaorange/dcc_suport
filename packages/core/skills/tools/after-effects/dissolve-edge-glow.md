# ディゾルブ境界グロー（Dissolve Edge Glow）

Unity Shader Graph のディゾルブエッジグロー技法を After Effects に応用する手法。

## 原理（Unity Shader Graph）

- Step ノードの閾値をわずかにオフセットした反転値とエミッションカラーを組み合わせ、ディゾルブ境界に光る線を生成する
- HDR カラー + ブルーム（Bloom）で発光を強調する

## AE での実装方法

### 方法1: Brightness オフセット差分（推奨・実証済み）

2つのフラクタルノイズレイヤー（A と B）の Brightness をオフセットし、減算で差分＝エッジバンドを抽出する。

#### プリコンポ内部（dissolve_edge プリコンポ）

1. dissolve マットレイヤーを2つ複製し `dissolve_edge_A`（下）と `dissolve_edge_B`（上）とする
2. 両レイヤーにフラクタルノイズ（Fractal Noise）を適用
   - Fractal Type: **Turbulent Smooth**、Noise Type: **Spline**
   - **Contrast を 400〜450 に上げる**（グレーを潰してほぼ二値化。両レイヤー同じ値にすること）
3. Brightness のキーフレームを設定：
   - **A の Brightness は常に B より +15〜20 高くする**（A が先行して白くなる）
   - この差が エッジバンドの幅 を決める。差が大きい＝太いエッジ、差が小さい＝細いエッジ
4. `dissolve_edge_B` のブレンドモードを **減算（Subtract）** に設定
5. 両レイヤーに VC Color Vibrance の **Matte Alpha** を適用（輝度→アルファ変換）
6. B に **Simple Choker** を適用してもよい（微調整用、必須ではない）

#### 外部コンポ（bg_effect_layer 上の dissolve_edge レイヤー）

1. **レベル補正（Levels）** — Input Black: 0.40、Input White: 0.80 程度で残存グレーを除去
2. **VC Color Vibrance** — Matte Alpha で最終アルファ調整
3. **ガウスぼかし（Gaussian Blur）** — 20px 程度で発光の滲みを出す
4. **色合い（Tint）** — Map White To をゴールド系に、Amount to Tint: 100%
5. **Deep Glow 2** — Glow Mode: Exponential、Blend Mode: Add、Radius: 150〜200、Exposure: 1.0

#### 注意点

- **A の Brightness は全キーフレームで B より高くする**こと。逆転するとエッジが消える
- A と B の **Contrast は同一値** にすること。異なると差分が不安定になる
- Simple Choker は空間的なアルファ境界に作用するため、フラクタルノイズの輝度パターン境界を絞る用途には向かない。Brightness オフセットで制御する
- 後半で輪郭だけになる場合は Gaussian Blur にキーフレームを打って後半を大きくぼかすか、Contrast を後半でキーフレームで下げる
- AE のレベル補正は **0〜1.0 の値域**（32bpc モード時）

### 方法2: Find Edges（非推奨）

1. dissolve マットレイヤーを複製する
2. エフェクト > スタイライズ > **輪郭検出（Find Edges）** を適用する
3. 抽出された境界線にカラー + グローを適用する

**注意**: フラクタルノイズのすべてのエッジを拾ってしまい、ディゾルブ境界だけを抽出できない。実用には不向き。

### 方法3: Simple Choker 差分（非推奨）

1. dissolve マットを複製する
2. 複製に **Simple Choker** で数ピクセル拡張する
3. 元マットとの差分でエッジバンドを取得する

**注意**: Simple Choker は空間的アルファエッジにしか作用せず、フラクタルノイズの輝度境界には効かない。Brightness オフセット方式を推奨。

## 参考

- [Unity Shader Graph Dissolve Effect](https://www.youtube.com/watch?v=0NuesGD0msI)
