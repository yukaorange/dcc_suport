# アナモルフィックストリーク（Anamorphic Streak）

## 概要
シネマ用アナモルフィックレンズで強い光源を撮影した際に発生する、水平方向に伸びる特徴的な光線フレアを再現する技法。シネマティックな高級感・幻想感を加える定番の演出。

## 原理
光源（ハイライト部分）を水平方向にのみ引き伸ばし、Screen/Addで合成することで、元の映像に光の帯だけを加算する。

## After Effects での実装

### 手順
1. **光源レイヤーを複製**: ストリークの発生源となるレイヤーを `Cmd+D` で複製
2. **水平方向にぼかす**: 複製レイヤーに **エフェクト > ぼかし > ブラー（方向）（Effect > Blur & Sharpen > Directional Blur）** を適用
   - Direction（角度）: **0°**（水平）
   - Blur Length（長さ）: **200〜400px**（画面幅に応じて調整）
3. **描画モードを変更**: 複製レイヤーのMode列を **スクリーン（Screen）** に
4. **強度を調整**: 不透明度（Opacity）で全体の強さを調整（50〜80%が目安）

### オプション調整
- **着色**: エフェクト > カラー補正 > 色合い（Tint）で暖色系に着色（ゴールド `#FFD700` 〜 アンバー `#FF8800`）
- **発光の追加**: Deep Glow 2 や標準Glow を追加してストリーク自体を柔らかく発光させる
- **多重化**: 複製を2〜3枚重ねてBlur Lengthや不透明度を変えると、太い光芯＋広がるハローの層が作れる

### 光源が映像全体の場合（実写フッテージなど）
光源を抽出する前処理が必要:
- マスクで光源部分だけを切り出す
- カーブ（Curves）やレベル補正（Levels）でハイライト以外を黒に落とす
- その上でDirectional Blurを適用

## DaVinci Resolve での実装
（参考: YouTube動画 https://www.youtube.com/watch?v=C-HHBXoQF04）

### Studio版
- カラーページ > OpenFX > ResolveFX Light > **Lens Flare** > プリセット「Anamorphic Handycam」を選択
- トラッカーで光源を追従させる

### Free版
1. クリップを複製（Alt/Optionドラッグ）
2. マスク（Circle）で光源を抽出 + カーブでハイライト以外を黒に
3. トラッカーで追従
4. OpenFX > ResolveFX Light > **Glow** を適用 → **H/V Ratio** で横長に引き伸ばす
5. 編集ページでComposite Modeを **Screen** に
6. 必要に応じて **Light Rays** エフェクトを追加して放射光線を加える

## AE vs DaVinci の対応表
| AE | DaVinci Resolve (Free) |
|---|---|
| レイヤー複製 (`Cmd+D`) | クリップ複製 (Alt+ドラッグ) |
| ブラー（方向） 角度0° | Glow の H/V Ratio |
| Screen描画モード | Screen Composite Mode |
| Deep Glow 2 / 標準Glow | Light Rays エフェクト |

## ポイント
- ストリークは**水平のみ**に伸ばすのが本物のアナモルフィックレンズの特性。斜めや放射状にはしない
- 色味はレンズコーティングの反射色に由来するため、シアン・ゴールド・アンバー系が定番
- 強すぎると安っぽくなるので、控えめに始めて足していく方が上品に仕上がる
