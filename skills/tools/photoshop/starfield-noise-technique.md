# Photoshop 星空・宇宙背景の作成テクニック

Source: [How to create a synthetic/cosmic starfield in photoshop](https://www.youtube.com/watch?v=kU-dUE-I8CE)

## 概要
ノイズフィルター・雲フィルター・調整レイヤー・ブレンドモードを組み合わせて、Photoshopだけで宇宙空間の背景をゼロから作成する手法。

## 手順

### Step 1: 新規ドキュメント
- File > New (Ctrl+N): 1920×1080px, 72ppi, 背景色: 黒

### Step 2: 星の生成
1. 背景レイヤーを右クリック → **スマートオブジェクトに変換（Convert to Smart Object）**
2. **フィルター > ノイズ > ノイズを加える（Filter > Noise > Add Noise）**
   - Amount: **200%**
   - Distribution: **均等分布（Uniform）**
   - グレースケールノイズ（Monochromatic）: ON
3. **フィルター > ぼかし > ぼかし（ガウス）（Filter > Blur > Gaussian Blur）**
   - Radius: **2.0px**
4. **レイヤー > 新規調整レイヤー > レベル補正（Layer > New Adjustment Layer > Levels）**
   - シャドウ入力スライダーを右へドラッグして星の密度・コントラストを調整

### Step 3: 星雲の色付け（Gradient Overlay）
1. 星レイヤーを右クリック → **レイヤー効果（Blending Options）**
2. **グラデーションオーバーレイ（Gradient Overlay）** を有効化
   - 描画モード: **覆い焼き（リニア）- 加算（Linear Dodge (Add)）**
   - 不透明度: 100%
   - スタイル: 線形（Linear）
   - 角度: 135°
   - グラデーション: プリセットの「Blues」を選択

### Step 4: クリッピング＆統合
1. レベル補正レイヤーを右クリック → **クリッピングマスクを作成（Create Clipping Mask）**
2. レベル補正 + 星レイヤーを両方選択 → 右クリック → **スマートオブジェクトに変換**

### Step 5: レンズフレア
- **フィルター > 描画 > 逆光（Filter > Render > Lens Flare）**
  - Brightness: 100%
  - Lens Type: 35mm Prime
  - プレビュー上でフレアの位置を調整

### Step 6: レンズフレアの色調整
- **レイヤー > 新規調整レイヤー > 色相・彩度（Hue/Saturation）**
  - 色彩の統一（Colorize）: ON
  - 色相: 210 / 彩度: 45 / 明度: 0
  - クリッピングマスクを適用

### Step 7: 雲レイヤー（3枚構成）

#### Cloud（乗算 / Multiply）
- 新規レイヤー → 50%グレーで塗りつぶし
- 前景: `#001540`（濃い青） / 背景: `#ffffff`（白）
- **フィルター > 描画 > 雲模様1（Filter > Render > Clouds）**
- 描画モード: **乗算（Multiply）**

#### Dark Cloud（覆い焼きカラー / Color Dodge）
- 新規レイヤー → 50%グレーで塗りつぶし
- 前景: `#ff0000`（赤） / 背景: `#d500ff`（紫）
- **フィルター > ぼかし > ぼかし（ガウス）: 150px**
- 描画モード: **覆い焼きカラー（Color Dodge）**

#### Burn Cloud（焼き込みカラー / Color Burn）
- 新規レイヤー → 50%グレーで塗りつぶし
- 前景: `#d500ff`（紫） / 背景: `#001540`（濃い青）
- **フィルター > 描画 > 雲模様1**
- 描画モード: **焼き込みカラー（Color Burn）**

### Step 8: 月の配置
- 月素材をドラッグ＆ドロップ → Ctrl+Tでサイズ調整
- レイヤー効果 > **光彩（外側）（Outer Glow）**
  - 描画モード: スクリーン / 不透明度: 75% / サイズ: 24px / 色: 白

## 表現技法のポイント

| テクニック | 意図・効果 |
|-----------|-----------|
| ノイズ200% + ぼかし2px + レベル補正 | ランダムな星の分布と密度を制御。スマートオブジェクト化で非破壊編集可能 |
| Gradient Overlay (Linear Dodge) | 星自体に色味を加え、星雲がガスの発光で色づくような効果 |
| 3枚の雲レイヤー（Multiply / Color Dodge / Color Burn） | 複数のブレンドモードで星雲の複雑な構造・濃淡・発光を表現 |
| Lens Flare + Hue/Saturation | 主光源の存在感を強調し、全体の色彩に統一感 |
| Outer Glow | 天体の自己発光を表現 |

## ショートカット
- `Ctrl+N`: 新規ドキュメント
- `Shift+Ctrl+N`: 新規レイヤー
- `Ctrl+T`: 自由変形
