# スモーク / ウィスプライン表現（After Effects）

ペンツールで描いた直線をベースに、Turbulent Displace + Echo で有機的に揺らめく煙・光の筋を作る手法。

## 手順

### 1. 直線の描画とストローク設定
- 新規シェイプレイヤーを作成
- ペンツール（Pen Tool / `G`）で垂直線を描画
- Fill をオフ、Stroke をオン
- Stroke カラーを **リニアグラデーション（Linear Gradient）** に設定
  - 下端：白 `#FFFFFF`
  - 上端：グレー `#AAAAAA`（先端が薄くなる表現）
- Stroke 幅：約 10px

### 2. Turbulent Displace の適用
- エフェクト（Effect）→ ディストーション（Distort）→ **Turbulent Displace**
- Amount（量）：150
- Size（サイズ）：100
- **Offset (Turbulence)** の Y 値をアニメーション
  - 0秒：Y = 540
  - 10秒：Y = -600（上方向に流れる動き）
- **Evolution** に `time * 20` エクスプレッション
- **Pinning**：`Pin Bottom Locked`（発生源の下端を固定）

### 3. Turbulent Displace の複製
- `Cmd+D` でエフェクトを複製
- Turbulent Displace 2 の設定：
  - Displacement：**Twist**（ねじれ）
  - Amount：50
  - Size：50

### 4. Echo エフェクトの適用
- エフェクト（Effect）→ 時間（Time）→ **Echo**
- Echo Time (seconds)：**-0.03**
- Number of Echoes：**50**
- Decay：**0.9**
- Echo Operator：**Composite in Back**

## 表現技法のポイント
- グラデーションストロークで先端が自然に消える
- Turbulent Displace の Y オフセットアニメーションで上方向の流れを表現
- Evolution エクスプレッションで有機的なランダム変化
- Pin Bottom Locked で発生源を固定
- 2 つの Turbulent Displace（大きなうねり + 細かいねじれ）で複雑な煙の構造
- Echo の残像効果で煙の密度・広がりを表現（Decay 0.9 で徐々にフェードアウト）

## 応用：光のウィスプへの変換
- ストロークカラーをゴールド系グラデーションに変更
- Stroke 幅を 2〜4px に細くする
- ブレンドモードを Add（加算）または Screen（スクリーン）に
- Deep Glow や標準グローで光の滲みを追加
- Amount を控えめ（80〜100）にすると繊細な光の筋になる
