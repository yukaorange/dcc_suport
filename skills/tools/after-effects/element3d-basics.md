# Element 3D V2 基本操作

## ワークフロー概要
1. ソリッドレイヤーを作成（コンポジションサイズ・黒背景）
2. `エフェクト > Video Copilot > Element`（Effect > Video Copilot > Element）を適用
3. エフェクトコントロールの **Scene Setup** ボタンをクリック → Element 3D専用UIが開く
4. UI内でモデル追加・マテリアル設定 → **OK** で閉じる
5. AE側のエフェクトコントロールで位置・回転・スケール等を制御

## Scene Setup UI の構成
- **Scene パネル**（左）: シーン内のモデル一覧。モデル選択・マテリアル適用先を選ぶ
- **Preview パネル**（中央）: 3Dプレビュー。ドラッグで回転、ホイールでズーム
- **Properties パネル**（右）: 選択中モデル/マテリアルのパラメータ
- **Presets ブラウザ**（右上の切り替え）: マテリアルプリセット一覧

## プリミティブ形状の追加
- Scene Setup UI 上部の **CREATE** メニューから追加:
  - **Plane**: 平面。今回のリング用途に最適
  - **Sphere**: 球体
  - **Cylinder**: 円柱
  - **Cube**: 立方体
- 追加後、Properties パネルで `Size X / Y`、`Segment X / Y` を調整

## マテリアル設定
### 発光マテリアル（Illumination）
- Scene パネルでモデルのマテリアル面を選択
- Properties > **Illumination** セクション:
  - `Color`: 発光色を設定（例: 青 0,0,255 / シアン 0,255,255）
  - `Intensity`: 発光強度（100%以上で強発光。例: 449%）
- `Basic Settings`:
  - `Diffuse Color`: 黒 (0,0,0) にすると発光のみが見える
  - `Ambient`: 0 にすると環境光の影響を排除

### 反射マテリアル（Reflectivity）
- `Reflect Mode`: `Mirror Surface` で鏡面反射
- `Glossiness`: 反射のシャープさ（77程度でやや粗い反射）

### プリセットの適用
- Properties パネル右上の **Presets** タブ → カテゴリから選択
- 主なカテゴリ: Physical, Metal, Glass, Plastic 等
- ダブルクリックまたはドラッグで選択中のマテリアルに適用

## Group 構成（AE側エフェクトコントロール）
- **Group 1〜Group 5**: 最大5グループ。各グループにモデルを割り当て可能
- 各グループの展開項目:
  - `Particle Look > Size`: サイズ
  - `Position XYZ`: 位置
  - `Rotation XYZ`: 回転
  - `Scale XYZ`: スケール
  - `Multi-Object`: 複数オブジェクト配置の制御

## Multi-Object 機能
- 1つのモデルを複数インスタンスとして配置
- `Array Setup`: グリッド・サークル等のパターン配列
- `Randomize`: 位置・回転・スケールのランダム化
- 今回の用途: リングの量産配置に活用

## Render Settings（レンダー設定）
- エフェクトコントロール > **Render Settings** セクション
- `Ambient Occlusion`: `Enable AO` オンで接触部の影を生成。`Sample` 3以上推奨
- `Shadows`: `Enable Shadow` オンで影を生成
- `Glow`:
  - `Enable Glow` オン
  - `Glow From Illumination` オン → Illumination設定した発光部分にグロー適用
  - `Glow Radius` / `Glow Intensity` / `Glow Threshold` で調整

## カメラとの連携
- AEの3Dカメラを作成すると、Element 3Dのシーンもカメラに追従
- カメラをヌルオブジェクトに親子付けし、ヌルで制御するのが定番

## ショートカット（AE側）
- `Ctrl+D` / `Cmd+D`: レイヤー複製
- `F9`: イージーイーズ適用
- `C`: カメラツール切り替え

## 出典
- [今さら聞けない Element3D！【基本編】](https://www.youtube.com/watch?v=u93Uy1TBEJA)
