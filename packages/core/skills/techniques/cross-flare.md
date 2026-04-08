# クロスフレア（十字光条）の作成技法

## 概要
After Effects標準エフェクトでシネマティックなクロスフレア（スターバースト）を作成する方法。
2つのパーツ（クロスフレア + 放射ライン）を別コンプで作り、最後に合成するモジュラー構成。

## 出典
- クロスフレア + 虹放射ライン: https://www.youtube.com/watch?v=XV7t40zuUbc
- シェイプベースのスターフレア: https://www.youtube.com/watch?v=wV76cuIn2dM

---

## 方法A: Lens Flare + Scale変形（クラシック・シンプル）

### STEP 1: フレアベースの作成
1. 新規コンプ（正方形推奨: 1000x1000、30fps）、黒平面を作成
2. **エフェクト > 描画 > レンズフレア（Lens Flare）** を適用
   - Lens Type: **35mm Prime**
   - Flare Center: コンプ中央 (500, 500)
   - Flare Brightness: `wiggle(5,5)` で微妙な明滅（ループ動画では `Math.sin(time * 3) * 5` に置換）
3. **エフェクト > ぼかし > CC Radial Fast Blur** を適用
   - Type: **Zoom**（Straight Zoomでも可）
   - Amount: **10**（控えめ。大きいほど筋が長くなる）
   - Center: 画面中央
4. **エフェクト > カラー補正 > カーブ（Curves）** でS字カーブ → コントラストを上げて筋をシャープに

### STEP 2: プリコンポーズ → 十字型に成形
1. ベースレイヤーを **プリコンポーズ**（`Cmd+Shift+C`）→ 名前 `EF_Base_flare`
2. プリコンプを **3回複製**（Cmd+D × 3）→ 計4レイヤー
3. 各レイヤーのScaleの**縦横比固定を解除**して：
   - **Scale X: 1000%, Scale Y: 0.04%** → 極端に水平に引き伸ばされた光条
4. 各レイヤーを異なる角度に回転：
   - 1層目: **0°**
   - 2層目: **45°**
   - 3層目: **90°**
   - 4層目: **135°**
5. 全複製レイヤーの描画モードを **Screen** に
6. → 8方向に広がるスターバースト完成

### STEP 3: 色味の調整
1. 調整レイヤー → **VC Color Vibrance** で色味を追加
   - Color: 紫系 `#DA4EF4` / 水色 `#00B1D4`（用途に合わせて変更）
   - Vibrance: **1.5**

---

## 方法B: シェイプレイヤー + パンク・膨張（造形の自由度が高い）

### STEP 1: スター形状の作成
1. 新規コンプ（500x500推奨）、黒平面を背景に
2. **多角形ツール（Star Tool）** で中央にShift+ドラッグ → シェイプレイヤー作成
3. コンテンツ > ポリスター 1 > ポリスターパス 1:
   - 種類: **ポリスター**
   - 点: **4**
   - 内半径: **50**
   - 外半径: **100**
4. 塗り（Fill）: **白**

### STEP 2: エフェクトで星型に成形
1. **エフェクト > ディストーション > パンク・膨張（Pucker & Bloat）** → 量: **100**
2. **エフェクト > ディストーション > CC Flomotion** → Amount 1: **300**, Amount 2: **300**
   → 4方向に鋭く尖った星型になる

### STEP 3: 放射状の光線を追加
1. 白い平面を新規作成
2. **リニアワイプ（Linear Wipe）** → Transition Completion: **75%**, Wipe Angle: **90°**, Feather: **50**
3. **ブラインド（Venetian Blinds）** → Transition Completion: **50%**, Direction: **0°**, Width: **20**, Feather: **20**
4. **ラフエッジ（Roughen Edges）** → Scale: **3**, Complexity: **5**
   - Scale (H/V): **100 / 0**（水平方向のみ）
   - サイクルエボリューション: **チェック**
   - Evolution エクスプレッション: `time * 720`

### STEP 4: 極座標で放射状に変換
1. **調整レイヤー** → **CC 極座標（Polar Coordinates）** → 直交座標を極座標に
2. 同調整レイヤーに **CC Radial Fast Blur** → Amount: **100**
3. 同調整レイヤーに **カーブ（Curves）** でコントラスト強調

### STEP 5: コンポジット
1. 新規コンプ（500x500）
2. tex_star コンプを配置 → 描画モード **Screen**
3. VC Color Vibrance で着色
4. シャープ（Sharpen）→ Amount: **100**

---

## 虹色放射ライン（方法Aのオプション拡張）

クロスフレアに加えて虹色の放射ラインを重ねる場合：

### 作成手順
1. 新規コンプ（1000x1000）、黒平面を作成
2. **フラクタルノイズ（Fractal Noise）** を適用:
   - Fractal Type: **Max Lines**
   - Contrast: **200**, Brightness: **-100**
   - Uniform Scaling: **オフ** → Scale Width: **2**, Scale Height: **3000**
   - Complexity: **2**
   - サイクルエボリューション: **チェック**
   - Evolution エクスプレッション: `time * 90`
3. **Linear Wipe × 2**:
   - 1つ目: Completion **75%**, Angle **0°**, Feather **100**
   - 2つ目: Completion **75%**, Angle **180°**, Feather **100**
   → 上下からフェードアウト
4. **ブラインド（Venetian Blinds）**: Completion **75%**, Direction **90°**, Width **10**, Feather **10**
5. **波形ワープ（Wave Warp）**: Type **Smooth Noise**, Speed **0**, Height **10**, Width **50**
6. **極座標（Polar Coordinates）**: Rect to Polar

### 虹色着色
1. 黒い平面に **レイヤースタイル > グラデーションオーバーレイ** → Style: **Angle（角度）**, Angle: **90°** → 虹色に設定
2. プリコンポーズ → **Colorama** を適用 → Cycle Repetition: **6**, Blend with Original: **0%**
3. 描画モード: **Overlay**

### 仕上げ
1. 調整レイヤー → **Glow** → Threshold: **70%**, Radius: **100** → **複製して2重にする**
2. 調整レイヤー → **Curves** で明るさ調整
3. 調整レイヤー → **Sharpen** → Amount: **50**

### 最終合成
1. 新規コンプ（1000x1000）
2. クロスフレアコンプと放射ラインコンプを配置
3. 放射ラインの描画モード: **Add（加算）**
4. 放射ラインの回転: **45°**（クロスの間を埋める配置）

---

## 合成時のポイント
- フレアコンプを本編コンプに配置 → 描画モード **Screen** or **Add**
- フレア中心を指輪のスペキュラ位置に合わせる
- `wiggle(5,5)` はループ動画に不向き → `Math.sin(time * 3) * 5` に置換
- ループ対応: Evolution の `time * N` は cycle evolution をオンにすることで自然にループ可能

## CC Radial Fast Blur の核心
このエフェクトが手法の核。Zoom モードは中心から外へ直線的にぼかす。
レンズフレアのハイライトをソースにすると、中心から放射状に光の筋が引き伸ばされる。
Amount が大きいほど筋が長くなる。Curves で中間値を潰せば筋がシャープになる。
