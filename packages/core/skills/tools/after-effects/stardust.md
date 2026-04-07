# Superluminal Stardust — ノードベース3Dパーティクルシステム

## 基本概念

Stardustはノードベースのモジュラー3Dパーティクルシステム。ノードを接続してパーティクルフローを構築する。

### 最小構成
```
Emitter → Particle
```
この2ノードだけでパーティクルが生成・表示される。

### ノードの接続ルール（重要）

| 接続状態 | 挙動 |
|---|---|
| **接続済み（特定ブランチに繋がっている）** | そのブランチのパーティクルにのみ影響する |
| **フリーフローティング（未接続）** | **全てのパーティクルシステムにグローバルに影響する** |
| **Emitter と Particle の間に接続** | パーティクルの**誕生時の速度・方向**に影響する（※発生座標のディスプレイスは不可） |
| **Particle の後に接続** | パーティクルの**ライフタイム全体**に影響する |

> **注意**: Force や Turbulence ノードは接続しなくても全パーティクルに作用する。接続は「影響範囲を限定する」ために使う。
>
> **実証済み（2026-04）**: Turbulence を Emitter-Particle 間に接続しても**誕生位置のランダム化にはならない**。球状の発生パターンが目立つ場合は、Emitter Type を **Box** に変更して Size X/Y/Z を広げるのが正解。

---

## ノード一覧

### Emitter（エミッター）
パーティクルの発生源。速度・方向・発生範囲などを設定する。

**Emitter Type（発生形状）:**
- **Point** — 1点から発生
- **Sphere** — 3D球体の表面/内部から発生
- **Box** — 3Dボックスの表面/内部から発生（均一な分布。Sphereで球状の輪郭が目立つ場合に推奨）
- **Grid** — XYZ密度を指定したグリッド状に発生（Box: XYZ density, Sphere: UV segments）
- **Layer** — AEレイヤーを発生源にする
- **Light** — AEのライトオブジェクトの位置から発生
- **Text** — テキストの形状から発生
- **Mask** — AEマスクの形状から発生
- **Path** — 3D B-spline（AEライトで定義）から発生
- **OBJ** — 3Dモデルから発生（Edges / Vertices / Volume の3モード）

**主なパラメータ:**
| パラメータ | 説明 |
|---|---|
| Particles Per Second | 毎秒の発生数 |
| Origin XY | 発生中心座標（コンプ座標系） |
| Origin Z | Z方向の発生位置 |
| Speed | 発生時の初速（0にすると発生位置に留まる） |
| Speed Random | 初速のランダム幅 |
| Speed Over Life | ライフタイムに応じた速度変化 |
| Size X / Y / Z | エミッター形状のサイズ（Sphere/Boxの場合の発生範囲） |
| Angle X / Y / Z | 発生方向の角度 |
| Direction | 発生方向の分布方式（Uniform等） |
| Orient X / Y / Z | 発生方向のオフセット |
| Direction Span | 発生方向の広がり角度 |
| Life (Seconds) | パーティクルの寿命（秒） |
| Life Random | 寿命のランダム幅 |
| Time Offset (Frames) | パーティクル発生の時間オフセット |
| Random Seed | シードの乱数値 |
| Birth Chance | 発生確率（100 = 全て発生） |
| Origin Time Sample | 時間サンプリングモード |

### Particle（パーティクル）
パーティクルの外観を定義する。

**主なパラメータ:**
| パラメータ | 説明 |
|---|---|
| Shape | 形状（Circle, Star, Sphere等） |
| Life (Seconds) | 表示寿命 |
| Life Random | 寿命ランダム幅 |
| Size (Pixels) | サイズ（ピクセル単位） |
| Size Random | サイズランダム幅 |
| Use Texture Ratio | テクスチャの縦横比を使用 |
| Ignore Perspective | パースペクティブ無視 |
| Opacity | 不透明度 |
| Opacity Random | 不透明度ランダム幅 |
| Particle Color | カラーモード（Solid Color, Gradient等） |
| Color | パーティクルの色 |
| Color Gradient | グラデーションで色を指定 |
| Particle Feather | パーティクルのエッジのぼかし |
| Transfer Mode | 描画モード（Normal, Add, Screen等） |
| Dip Axis | 回転軸 |

**Over Life セクション:**
パーティクルのライフタイムに応じてプロパティをカーブで制御できる。
- **Opacity over Life** — 寿命に応じた不透明度変化（0→100→0 で自然なフェードイン/アウト）
- **Size over Life** — 寿命に応じたサイズ変化
- **Color over Life** — 寿命に応じた色変化（グラデーションから選択）

**Shadow Properties:** パーティクルの影設定
**Cloud Properties:** クラウド/ボリューム設定

### Force（フォース）
物理的な力を適用する。**未接続でもグローバルに全パーティクルに影響する。**

**主なパラメータ:**
| パラメータ | 説明 |
|---|---|
| Gravity | 重力（マイナス値で上方向への力） |
| Gravity Random | 重力のランダム幅 |
| Gravity Over Life | ライフタイムに応じた重力変化 |
| Wind X / Y / Z | 各軸方向の風力 |
| Wind and Spin Over Life | ライフタイムに応じた風力変化 |
| Spin Frequency | 回転頻度 |
| Spin Seed | 回転のシード値 |
| Air Density | 空気密度（抵抗） |

### Turbulence（タービュランス）
スムーズドノイズでパーティクルに有機的な揺らぎを与える。**未接続でもグローバルに影響する。**

位置・色・サイズなど複数のプロパティに適用可能。

**主なパラメータ（実際のUIプロパティ名）:**
| パラメータ | 説明 |
|---|---|
| Turbulence Type | ノイズタイプ（Normal / Harmonic 等） |
| Dissolve size | ノイズのスケール軸設定（Axis 1/2/3） |
| Turbulence effect | タービュランスの全体強度 |
| Turbulence Resolution | ノイズの解像度 |
| Turbulence Origin XY | タービュランス原点のXY座標 |
| Turbulence Origin Z | タービュランス原点のZ座標 |
| Position effect | 位置の揺らぎの強さ（主要パラメータ。20〜40で浮遊感） |
| Scale effect | サイズへの揺らぎの影響 |
| Color effect | 色への揺らぎの影響 |
| Opacity effect | 不透明度への揺らぎの影響 |
| Rotation effect | 回転への揺らぎの影響 |
| Texture Over Life (Thread) | ライフタイムに応じたテクスチャ変化 |

> **注意**: 以前「Amount」「Scale」「Speed」「Complexity」と記載していたが、実際のStardust UIでは上記のプロパティ名が使われる。

### Field（フィールド）
パーティクルの空間を変形するデフォーマー。

**フィールドタイプ:**
- **Spherical** — 球状の影響範囲
- **Maps** — マップベースのデフォーメーション（ビルトインマップ or AEレイヤー、2軸マッピング/球面投影）
- **Black Hole** — パーティクルを特定点に引き寄せる。OriginをNull/Lightに設定可能
- **Box** — ボックス型の影響範囲
- **3D Models** — 3Dモデル形状の影響範囲
- **Bend** — 曲げ変形
- **Twist** — ねじり変形

Maps には **Density** プロパティがある。

### Auxiliary（オグジリアリー）
他のパーティクルからパーティクルを発生させるセカンダリエミッター。

### Replica（レプリカ）
パーティクルシステムを複製して配列する。

**レプリカタイプ:**
- **Offset** — 各コピーを前のコピーからオフセット
- **Linear** — 直線状に配列（最初のパーティクルからの線形オフセット）
- **Grid** — グリッド状に配列
- **Corners** — コーナーに配置
- **Radial** — 放射状に配列

Redistribute: コピーを均等に再分布する機能。

### Model（モデル）
3Dモデル（OBJ）をパーティクルとして使用する。

**OBJの発生モード:**
- Edges — 面のエッジから発生
- Vertices — 頂点からのみ発生
- Volume — モデルのボリューム内から発生

### Material（マテリアル）
3Dモデルのマテリアル設定。

### Deformer（デフォーマー）
3Dモデルに変形を適用する。Modelノードに接続して使用。
- Bend / Twist / Stretch
- ディスプレイスメントマップ
- タービュランスノイズ

### Shader（シェーダー）
パーティクルのシェーディングを追加制御する。

### Null（ヌル）
パーティクルシステムを空間内で移動する（位置・回転・スケール）。

---

## レンダリング設定

| 機能 | 説明 |
|---|---|
| Motion Blur | パーティクルのモーションブラー（ON/OFF切り替え） |
| Depth of Field | 被写界深度エフェクト |
| Shadows | 3Dレンダリングエンジンによる影 |
| Volumetric Fog | ボリュメトリックフォグ効果 |
| 3D Volumetric Lights | ボリュメトリックライト（シーンの影を考慮） |
| Environment Layer | 環境レイヤーの指定 |
| Render Outputs | Shadow / Volumetric 等の出力 |

---

## よくあるレシピ

### 浮遊する微粒子（ダスト/スパークル）
```
Emitter（Box, Speed=0, Size大きめ）→ Particle（Circle, Size=2-5, Gold）
Force（Gravity=-5〜-15）※未接続でOK
Turbulence（Position effect=20〜40）※未接続でOK
```
- Emitter Speed=0 で発生位置に留まらせる
- **Emitter Type は Box を推奨**（Sphereだと球状の輪郭が見えてしまう）
- Emitter Size X/Y を広げて空間全体に分布
- Force の Gravity マイナスで上方向にドリフト
- Turbulence の Position effect で有機的な揺らぎ
- Particle の Opacity over Life で 0→100→0 のフェードイン/アウト
- レイヤー描画モード: Screen or Add

### 放射状パーティクル（バースト）
```
Emitter（Point, Speed=高め）→ Particle（Star, Size=3-8）
Force（Gravity=正の値）
```

### セカンダリパーティクル（火花の尾など）
```
Emitter → Particle → Auxiliary → Particle(2)
```

---

## 参考リンク
- [公式ユーザーガイド](https://superluminal.tv/user-guide)
- [公式チュートリアル一覧](https://superluminal.tv/tutorials)
- [aescripts.com Stardust](https://aescripts.com/stardust/)
- [MotionArray Stardust解説](https://motionarray.com/learn/after-effects/stardust-a-new-after-effects-particle-plug-in/)
