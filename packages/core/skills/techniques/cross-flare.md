# クロスフレア（十字光条）の作成技法

## 概要
After Effects標準エフェクトでシネマティックなクロスフレア（スターバースト）を作成する方法。
レンズフレア + CC Radial Fast Blur + スケール変形で十字型の光条を構築する。

## 出典
YouTube チュートリアル: https://www.youtube.com/watch?v=XV7t40zuUbc

## 手順

### STEP 1: フレアベースの作成
1. 新規コンプ（正方形推奨: 1000x1000）、黒平面を作成
2. **エフェクト > 描画 > レンズフレア（Lens Flare）** を適用
   - Lens Type: 35mm Prime
   - Flare Brightness: `wiggle(5,5)` で微妙な明滅を追加
3. **エフェクト > ぼかし > CC Radial Fast Blur** を適用
   - Type: **Straight Zoom**
   - Amount: **150**
   - Center: 画面中央
   - → 中心から放射状に光が引き伸ばされて「光の筋」になる
4. **エフェクト > カラー補正 > カーブ（Curves）** でコントラストを上げる

### STEP 2: 十字型に成形
1. ベースレイヤーを **2回複製**（Cmd+D × 2）
2. 1つ目の複製: **Scale** → X: 100%, **Y: 2%** → 水平の光条になる
3. 2つ目の複製: **Scale** → **X: 2%**, Y: 100% → 垂直の光条になる
4. 複製2レイヤーの描画モードを **Screen** に変更
5. → 元のフレア（丸い光）+ 水平光条 + 垂直光条 = クロスフレア

### STEP 3: 色味の調整
1. 調整レイヤー → Curves で全体の明るさ/コントラスト
2. 調整レイヤー → VC Color Vibrance（無料プラグイン）で色味を追加
   - Color: 紫系やゴールド系（用途に合わせて）
   - Preserve Alpha: On

## 応用: 虹色放射ライン（オプション）
フレアに加えて虹色の放射ラインを重ねる場合：
1. 黒平面 → フラクタルノイズ（Contrast: 221, Brightness: -110, Scale Width: 2, Scale Height: 3000）
2. Linear Wipe × 2（上下からフェード）+ Blinds（横から間引き）
3. Wave Warp（Smooth Noise, Height: 10, Width: 20, Speed: 0）で有機的な歪み
4. **Polar Coordinates**（Rect to Polar）で放射状に変換
5. Gradient Overlay で虹色着色
6. Glow + Sharpen で仕上げ

## 合成時のポイント
- フレアコンプを本編コンプに配置 → 描画モード **Screen** or **Add**
- 45度回転した複製を重ねると8方向の光条（= より複雑なスターバースト）
- フレア中心を指輪のスペキュラ位置に合わせる
- `wiggle(5,5)` の明滅がループ動画には不向きな場合、`Math.sin(time * 3) * 5` に置き換える

## CC Radial Fast Blur の核心
このエフェクトが手法の核。Straight Zoom モードは中心から外へ直線的にぼかす。
レンズフレアのハイライトをソースにすると、中心から放射状に光の筋が引き伸ばされる。
Amount が大きいほど筋が長くなる。Curves で中間値を潰せば筋がシャープになる。
