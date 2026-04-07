# ディゾルブ境界グロー（Dissolve Edge Glow）

Unity Shader Graph のディゾルブエッジグロー技法を After Effects に応用する手法。

## 原理（Unity Shader Graph）

- Step ノードの閾値をわずかにオフセットした反転値とエミッションカラーを組み合わせ、ディゾルブ境界に光る線を生成する
- HDR カラー + ブルーム（Bloom）で発光を強調する

## 共通の前提: クリーンな二値マットを作る

どの方法でも、フラクタルノイズを**完全な二値（白か黒）に近づける**ことが成功の前提条件。中間グレーが残っていると、エッジ抽出が内部テクスチャのノイズを拾って破綻する。

### 二値化のレシピ

1. **フラクタルノイズ**: Contrast **200〜500**、Brightness をアニメーション
2. **Curves（カーブ）エフェクト**: 急峻なS字カーブを適用し、中間グレーを完全に潰す
   - エフェクト > カラー補正 > カーブ（Effect > Color Correction > Curves）
   - シャドウ側を下げ、ハイライト側を上げるS字型にする
   - これにより Contrast だけでは残る中間値を排除し、純粋な二値マットを得る
3. **プリコンポーズ**: 上記をプリコンプに入れて「Burn Texture」等の名前で管理

**重要**: Contrast を上げるだけでは不十分。Curves の S字カーブが「ノイズの内部テクスチャを殺して、ディゾルブ境界だけを残す」フィルターとして機能する。

## AE での実装方法

### 方法1: Curves 閾値オフセット差分（実証済み・推奨）

2つのフラクタルノイズレイヤー（A と B）に同じ急峻なS字カーブを適用し、**Curves の閾値位置だけをずらして**減算でエッジバンドを抽出する。

> 詳細な原理解説: [S字カーブ閾値オフセットによるエッジ抽出](../../techniques/s-curve-threshold-edge-extraction.md)

#### 原理

- S字カーブは閾値関数（Step関数）の近似。閾値より上なら白、下なら黒に振り分ける
- A と B に**同じ形のS字**を適用し、**B の中間点だけを右にずらす**（白になる範囲を狭める）
- Subtract で「A では白だが B ではまだ黒」のピクセル＝**閾値境界の差分帯だけ**が残る

#### なぜ Brightness オフセットではなく Curves オフセットか

Brightness は全ピクセルに一律加算されるため、S字カーブの勾配部分で中間値が残り、差分がクリーンなエッジにならない。**Curves の閾値位置をずらす**方が、差分の発生箇所を境界だけに限定できる。

#### なぜ両方ともS字でなければならないか

B を直線的な Curves にすると、B は中間グレーを大量に保持する。A（S字で二値化済み）との差が広い面積に散らばり、エッジではなくノイズが出る。**両方が同じ急峻さのS字**であることで、差分が閾値ライン周辺の薄い帯に限定される。

#### 手順

1. dissolve マットレイヤーを作成し `dissolve_edge_A`（下）とする
   - フラクタルノイズ: Contrast **200** 程度
   - Curves: **急峻なS字カーブ**（中間グレーを潰す）
2. レイヤーを **複製** して `dissolve_edge_B`（上）とする
3. **B の Curves の中間点だけを右にずらす**
   - Fractal Noise の設定（Contrast, Brightness, Random Seed 等）は A と完全に同一のまま
   - 閾値の差 = エッジバンドの太さ
4. `dissolve_edge_B` のブレンドモードを **減算（Subtract）** に設定

#### エッジ幅の制御

- **A と B の Curves 閾値位置の差**: 大きい → 太いエッジ、小さい → 細いエッジ
- **S字カーブの急峻さ**: 急峻 → シャープ、緩やか → ソフト

#### 後処理（親コンプまたは外部コンプ）

1. **ガウスぼかし（Gaussian Blur）** — エッジを滑らかにする
2. **色合い（Tint）/ 三色調（Tritone）** — エッジにカラーを付ける
3. **グロー（Glow）/ Deep Glow** — 発光を追加
4. 描画モードを **加算（Add）** または **スクリーン（Screen）** に

### 方法2: Find Edges + Curves 二値化

クリーンな二値マットに Find Edges を適用し、ディゾルブ境界のエッジラインだけを抽出する。Curves による前処理が肝。

#### 手順

1. **二値マットの作成**: 上記「二値化のレシピ」に従いフラクタルノイズ + Curves のプリコンプ（Burn Texture）を作成
2. **ルママットとして使用**: メインコンプで Burn Texture を対象レイヤーの上に配置し、対象レイヤーのトラックマットを **ルミナンスマット（Luma Matte）** に設定 → ディゾルブが動作する
3. **エッジ抽出用コンプの作成**:
   - プロジェクトパネルで Burn Texture コンプを **Cmd+D で複製**
   - 複製コンプを開き、中のレイヤーに **エフェクト > スタイライズ > 輪郭検出（Find Edges）** を適用
   - Find Edges の **Invert にチェック**（エッジを白、背景を黒にする）
   - このコンプを **プリコンポーズ** して「Burn Lines」等の名前にする
4. **カラーとグローの適用**（Burn Lines レイヤーに）:
   - **色合い（Tint）** または **三色調（Tritone）** でカラーを付ける
     - Tritone: Highlights をほぼ白、Midtones をオレンジ、Shadows を黄色
   - **グロー（Glow）** または **Deep Glow** で発光を追加
   - 描画モードを **スクリーン（Screen）** に変更

#### なぜ Curves が必要か

- フラクタルノイズは Contrast を上げても内部に微細なグラデーションが残る
- Find Edges はすべてのエッジ（＝輝度変化）を検出するため、内部ノイズのエッジも拾ってしまう
- Curves の S字カーブで中間値を潰すことで、**ディゾルブ境界（白↔黒の遷移）だけがエッジとして残る**

### 方法3: Glow Based On Alpha Channel

フラクタルノイズのルミナンスマットでディゾルブすると、マット適用後のレイヤーの **アルファ境界＝ディゾルブ境界** になる。AE 標準のグローエフェクトの **Glow Based On** パラメータを **Alpha Channel** に設定することで、そのアルファ境界だけを発光させる。

**注意**: この方法はアルファ輪郭全体に対するソフトなグローであり、フラクタルノイズのパターンに沿ったシャープなエッジバンドとは異なる仕上がりになる。シャープなエッジ発光が必要な場合は方法1を使用すること。

#### 手順

1. **プリコンポーズ**: 対象レイヤーとそのトラックマット（フラクタルノイズ）レイヤーを選択し、右クリック → プリコンポーズ（Pre-compose）
   - 「すべての属性を新しいコンポジションに移動（Move all attributes into the new composition）」を選択
2. **複製**: 親コンプでプリコンプレイヤーを `Cmd+D` で複製
3. **グロー適用**: 上の複製レイヤーに エフェクト > スタイライズ > グロー（Effect > Stylize > Glow）を適用
   - **Glow Based On: Alpha Channel**
   - Glow Threshold: **40〜60%**
   - Glow Radius: **20〜40**
   - Glow Intensity: **1.5〜2.5**
4. **描画モード**: 複製レイヤーの描画モードを **加算（Add）** に変更

## 参考

- [Unity Shader Graph Dissolve Effect](https://www.youtube.com/watch?v=0NuesGD0msI)
- [AE Burn Dissolve with Edge Glow](https://www.youtube.com/watch?v=1YdX3UpVKTo) — Find Edges + Curves 二値化の参考
- [Creative COW: Fire Dissolve Effect](https://creativecow.net/forums/thread/fire-dissolve-effect/) — Glow Based On Alpha Channel の参考
