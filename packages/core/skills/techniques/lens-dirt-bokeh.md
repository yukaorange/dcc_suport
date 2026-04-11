# レンズダート / ボケ玉オーバーレイの作成

カメラのレンズに付いた汚れ・ホコリが強い光源で浮かび上がる「ボケ玉」表現。
映画やゲーム演出で「カメラ越しに覗いている」感覚と高級感を出す。

## 完成形の特徴

- 大きなボケ玉（直径50〜150px級）
- 縁が明るく中心がやや暗いリング状（実際のレンズボケの光学特性）
- サイズがバラバラ（大小混在）
- 周辺に集中、中央は暗い（ビネット的配置）
- プリズム色収差（各ボケ玉がRGBに分離して虹色）

## NG: ノイズ→しきい値方式

フラクタルノイズやAdd Noiseから2階調化する方法は「微細な光の粒」用。
大きなレンズボケとは別物。サイズ・形状の制御ができない。

---

## 推奨方法: カスタムボケブラシ（Photoshop）

### Step 1: ボケ玉の「型」を作る

1. **新規ドキュメント** 500x500px、白背景
2. **楕円形ツール（U）** で 400x400px の**黒い正円**を中央に描く
3. レイヤースタイル > **光彩（内側）（Inner Glow）** を適用:
   - 色: **白**
   - ブレンドモード: **通常（Normal）**
   - 不透明度: **80%**
   - サイズ: **100px** 程度
   - → 縁が明るく中心が暗いリング状のボケ形状ができる
4. レイヤーを統合
5. **編集 > ブラシを定義（Edit > Define Brush Preset）**

### Step 2: ブラシの散布設定

ブラシ設定パネル（ウィンドウ > ブラシ設定 / Window > Brush Settings）:

| 項目 | 設定 |
|------|------|
| 間隔（Spacing） | 100〜150% |
| シェイプ > サイズのジッター（Size Jitter） | 100%（大小バラバラ） |
| シェイプ > 角度のジッター（Angle Jitter） | 100% |
| 散布（Scattering） > 散布 | 1000%、両軸にチェック |
| その他 > 不透明度のジッター（Opacity Jitter） | 100%（濃淡バラバラ） |
| その他 > フローのジッター（Flow Jitter） | 50% |

### Step 3: 塗る

- 黒ベタレイヤー上で、ブラシ色を**白**にして塗る
- **周辺部を中心に**ストローク（中央は空ける）
- ブラシサイズを途中で変えて大小のバリエーションを出す

### Step 4: 仕上げ（Photoshop）

- **ガウスぼかし（Gaussian Blur）** 3〜8px（エッジを柔らかくする程度）
- 必要に応じてレベル補正で明暗のバランスを調整

---

## AEでの仕上げ

### 色収差（プリズム効果）

- **Quick Chromatic Aberration 3** でRGBチャンネルを分離
  - Position: -40〜-80（控えめな値）
  - → 各ボケ玉の周辺にシアン・マゼンタ・イエローのフリンジが自動生成

### 合成

- 描画モード: **スクリーン（Screen）**（黒が透明になり、ボケ玉だけが光として乗る）
- 不透明度: 20〜50%（控えめに）

### 発光

- **Deep Glow 2** でソフトなブルームを追加
- Tint でゴールド〜アンバー系に着色（シーンの色調に合わせる）

---

## PS / AE の役割分担

| 担当 | Photoshop | After Effects |
|------|-----------|---------------|
| ボケ玉の形状 | カスタムブラシで描画 | - |
| ぼかし（形状用） | ガウスぼかし（軽め） | - |
| 色収差 | - | Quick Chromatic Aberration 3 |
| 発光・グロー | - | Deep Glow 2 |
| 色味・着色 | - | Tint / Curves |
| 合成・ブレンド | - | Screen モード |
| アニメーション | - | エクスプレッション等 |

Photoshopは「白黒の形状」だけ作り、色・光・動きは全てAEに委ねる。

## 参考

- [How to Make a Bokeh Brush in Photoshop | Envato Tuts+](https://design.tutsplus.com/tutorials/how-to-make-a-bokeh-brush-in-photoshop--cms-36475)
- [How to Make a Bokeh Background in Photoshop | Envato Tuts+](https://design.tutsplus.com/tutorials/how-to-make-a-bokeh-background-in-photoshop--cms-36082)
- [Creating Lens Flare and Dust Particles in Photoshop](https://digital-photography-school.com/creating-lens-flare-effect-dust-particles-photoshop/)
