# グラデーション

- 線形グラデーション: 2点間の直線的な色変化
- 放射グラデーション: 中心点から同心円状に広がる色変化
- 角度グラデーション: 指定した角度を軸に回転する
- アプリによる呼称の違い: Photoshopは「グラデーションオーバーレイ」、Illustratorは「グラデーションパネル」

## After Effects: 対称グラデーション（3ストップ以上）

AEの Gradient Ramp は2色（Start / End）しか持てないため、黒→白→黒や白→黒→白のような対称グラデーションは単体では作れない。

### 方法: Gradient Ramp + Mirror

Gradient Ramp で片半分だけグラデーションを描き、Mirror エフェクトで中央を軸に鏡像コピーする。

**手順（例: 黒→白→黒、コンプ幅900pxの場合）:**

1. 平面レイヤーに **エフェクト > 描画 > グラデーションランプ（Effect > Generate > Gradient Ramp）** を適用
   - Ramp Shape: **Linear Ramp**
   - Start of Ramp: `0, 450`（左端中央）→ Start Color: **黒**
   - End of Ramp: `450, 450`（コンプ中央）→ End Color: **白**
   - ※ 左半分だけに黒→白のグラデーションを作る
2. 同レイヤーに **エフェクト > ディストーション > ミラー（Effect > Distort > Mirror）** を追加（Gradient Rampの下に配置）
   - Reflection Center: `450`（コンプ中央X座標）
   - Reflection Angle: `0°`

**原理:** Gradient Ramp が左半分に黒→白を描画し、Mirror が中央を境に右半分を鏡像コピーする。結果として黒→白→黒の対称グラデーションが完成する。

**バリエーション:**
- 白→黒→白: Start ColorとEnd Colorを逆にする
- 中央をずらす: End of RampとReflection Centerの位置を揃えて移動
- コロラマと組み合わせ: このグラデーションの輝度をColoramaのInput Phaseとして使えば、対称的な多色グラデーション（例: ティール→ゴールド→ティール）が1レイヤーで実現できる
