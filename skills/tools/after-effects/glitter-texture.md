# AE標準エフェクトでGlitter Texture（キラキラ背景）を自作する

## 概要
CC Particle World + CC Cross Blur + Glow を組み合わせて、微細な輝点が散るグリッターテクスチャをプラグインなしで作成する手法。
背景演出のほか、描画モードやトラックマットを工夫すれば線画のかすれマスクや装飾テクスチャとしても応用可能。

参考動画: [Glitter Background 標準FX100%でつくるキラキラ背景](https://www.youtube.com/watch?v=-rc6w4nvzJM)

## 手順

### 1. 新規平面を作成
- **Layer → New → Solid（Cmd+Y）** → 黒、コンポサイズ
- 名前: `Glitter`

### 2. CC Particle World を適用
- **Effect → Simulation → CC Particle World**
- 設定:
  - **Extras → Hold Particle Release: `100%`**（パーティクルを持続表示）
  - **Producer → Radius X/Y/Z: `0.600`**（発生範囲を広げる）
  - **Particle → Particle Type: `Star`**（星型）
  - Birth Color: 青系 `#177FF0` / Death Color: 白 `#FFFFFF`
  - **Birth Size: `0.000`** / **Death Size: `0.120`**（徐々に大きくなる）
  - Opacity Map: グラフを波打つ形に調整 → 点滅・揺らめき感

### 3. CC Cross Blur を適用
- **Effect → Blur & Sharpen → CC Cross Blur**
- Radius X/Y: `15.0`（光の輪郭を柔らかく）

### 4. 描画モードを加算に
- レイヤーの描画モード: **Add（加算）**

### 5. レイヤーを複製して光の拡散を追加
- `Glitter`レイヤーを **Cmd+D** で複製
- 複製側の CC Cross Blur → Radius X/Y: `150.0`（大きく拡散する光のベール）

### 6. 調整レイヤーにGlowを2段がけ
- **Layer → New → Adjustment Layer（Cmd+Opt+Y）**
- **Effect → Stylize → Glow**（1回目）:
  - Threshold: `65%` / Radius: `80` / Intensity: `1.0`
- **Effect → Stylize → Glow**（2回目）:
  - Threshold: `65%` / Radius: `270` / Intensity: `1.0`

### 7.（任意）カメラアニメーション
- **Layer → New → Camera** → 35mm, Two-Node
- Camera Position の Z値にキーフレーム → ズームイン

## 表現技法のポイント

| テクニック | 効果 |
|-----------|------|
| Particle Type: Star | 十字の輝点で星らしいシルエット |
| Birth Size 0 → Death Size 0.12 | 粒が生まれて育つ生命感 |
| Opacity Map を波形に | 不規則な点滅・揺らめき |
| CC Cross Blur 小(15) + 大(150) の2層 | 鮮明な輝点 + 背景の光のベール |
| Add（加算）モード | 光の重なりで明るさ増幅 |
| Glow 2段がけ（80 + 270） | 近距離の鋭い輝き + 遠距離の柔らかい拡散 |

## 天体図かすれ表現への応用

### マットとして使う場合
- Glitterレイヤーの描画モードをAddではなく**通常**に戻す
- 線画レイヤーのトラックマットを**ルミナンスマット（Luma Matte）**に設定
- → 輝点の位置だけ線が残り、それ以外が消える＝微細な粒子状のかすれ
- フラクタルノイズのマットと**プリコンポーズで組み合わせる**と、大きなかすれ + 微細な粒子感が共存

### 背景テクスチャとして使う場合
- ネイビー背景の上にGlitterレイヤーを配置
- 描画モード: **Screen（スクリーン）** / 不透明度: 5〜15%
- → 星屑のような微細な輝点が背景に散る
