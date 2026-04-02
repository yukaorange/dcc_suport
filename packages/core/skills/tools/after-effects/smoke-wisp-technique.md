# 煙・光の筋（ウィスプ）の作成テクニック

## 概要
シェイプレイヤーの直線から、Turbulent Displace + Echo で上昇する煙のような光の筋を作成する手法。
標準エフェクトのみで完結する。

## 手順

### 1. シェイプレイヤーの作成
- ペンツール (`G`) で垂直な直線を描画
- Fill: なし / Stroke のみ
- Stroke をリニアグラデーションに変更（始点: 白、終点: 薄いグレー）
- Stroke Width: 約 10px

### 2. Turbulent Displace（1回目）
- Effect > Distort > Turbulent Displace
- Amount: 150
- Size: 100
- Offset (Turbulence) の Y値をアニメーション（0:00 で初期値 → 10:00 で -600 程度）
- Evolution にエクスプレッション: `time*20`
- Pinning: **Pin Bottom Locked**（発生源を固定し上部のみ動かす）

### 3. Turbulent Displace（2回目・複製）
- 1回目を Cmd+D で複製
- Displacement: **Twist** に変更
- Amount: 50
- Size: 50
- ひねりを加えて煙の複雑さ・立体感を追加

### 4. Echo エフェクト
- Effect > Time > Echo
- Echo Time: **-0.03**（マイナス値で過去フレームの残像を生成）
- Number of Echoes: **50**
- Decay: **0.9**
- Echo Operator: **Composite In Back**
- 煙が空間に漂いながら薄れていくボリューム感を表現

## 表現技法のポイント
- Pin Bottom Locked により煙の発生源が固定され、上部のみ自由に動く
- Twist Displacement で波状の動きにひねりが加わり立体的な質感になる
- Echo の残像でボリュームと連続性を表現
- グラデーションストロークで下部が濃く上部が薄い自然な煙の質感
