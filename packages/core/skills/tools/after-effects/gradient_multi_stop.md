# After Effects: 多色グラデーション (3ストップ以上) の作り方

> 最終更新: 2026-04-07

## 課題

After Effects の Gradient Ramp は始点色と終点色の2色しか持てない。
「黒→白→黒」のような3ストップグラデーションを直接作ることはできない。

---

## 方法1: Gradient Ramp + Mirror (推奨)

最もシンプルで確実な方法。半分のグラデーションを作り、ミラーで反転させる。

### 手順 (1920x1080 コンポジションの場合)

1. 新規平面レイヤーを作成 (Cmd+Y)
2. `Effect > Generate > Gradient Ramp` を適用
   - Ramp Shape: **Linear Ramp**
   - Start of Ramp: **(0, 540)** (左端中段)
   - Start Color: **黒 (0,0,0)**
   - End of Ramp: **(960, 540)** (中央中段)
   - End Color: **白 (255,255,255)**
3. `Effect > Distort > Mirror` を適用
   - Reflection Center: **(960, 540)** (コンポジション中央)
   - Reflection Angle: **0**

### 結果

左端=黒、中央=白、右端=黒 の水平リニアグラデーション。

### 応用

- Reflection Angle を 90 にすれば垂直方向のミラーも可能
- Mirror の前に他のエフェクトを挟めば、ミラーの対象を変えられる
- Gradient Ramp の End of Ramp を中央からずらせば非対称なグラデーションも作れる

---

## 方法2: Gradient Ramp を2つ重ねる

1レイヤーに Gradient Ramp を2つ適用する方法。ただし注意点がある。

### 手順

1. 新規平面レイヤー (黒)
2. `Gradient Ramp #1` を適用
   - Start of Ramp: (0, 540) / Start Color: 黒
   - End of Ramp: (960, 540) / End Color: 白
   - Blend With Original: 0%
3. `Gradient Ramp #2` を適用
   - Start of Ramp: (1920, 540) / Start Color: 黒
   - End of Ramp: (960, 540) / End Color: 白
   - **Blend With Original: 100%** (重要)

### 注意

- Gradient Ramp #2 の Blend With Original のデフォルトは 0% なので、必ず 100% に変更すること
- Blend With Original = 100% の場合、#2 は #1 の結果にブレンドされる (Screen 的な合成)
- 厳密にはリニア補間のScreen合成になるため、方法1のMirrorほど正確な対称にならない場合がある

---

## 方法3: エクスプレッションベース

AE標準エクスプレッションではピクセル単位の色制御はできないため、
Gradient Ramp のパラメータをエクスプレッションで動的に制御する形になる。

グラデーション自体をエクスプレッションで生成したい場合は、
Fractal Noise のコントラスト/明るさ制御やサードパーティプラグインを検討する。

---

## 補足: 4 Color Gradient は不向き

`Generate > 4-Color Gradient` は4隅の色を補間するエフェクトで、
中央に独立したカラーストップを置けないため、この用途には不向き。

---

## 汎用パターン: N色グラデーション

任意のN色グラデーションが必要な場合:

- **シェイプレイヤーのグラデーション塗り**: After Effects CC以降、シェイプレイヤーの塗りにグラデーションを使用でき、複数のカラーストップを設定可能
- **Photoshop/Illustratorで作成して読み込み**: 複雑なグラデーションは外部ツールで画像として作成し、AEに読み込む方が効率的な場合もある
- **Gradient Ramp + Mirror の連鎖**: 複数のMirrorやエフェクトを組み合わせて複雑なパターンを構築
