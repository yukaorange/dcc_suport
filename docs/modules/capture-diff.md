# capture.ts / diff.ts モジュール仕様

最終更新: 2026-03-04

## 全体フロー

```mermaid
graph LR
  A["デスクトップ画面"] --> B["screenshot-desktop<br/>OS命令で画面を撮影"]
  B --> C["sharp<br/>resize(1280px)<br/>ensureAlpha(RGBA)<br/>raw pixels 取得<br/>→ PNG 再エンコード"]
  C --> D["capture.ts が返すもの<br/>- pngBuffer<br/>- rawPixels<br/>- widthPx<br/>- heightPx"]
  D -->|"pngBuffer"| E["AI送信用 (DCC-06)"]
  D -->|"rawPixels"| F["diff.ts<br/>(pixelmatch)"]
  G["前回の rawPixels"] --> F
  F --> H["diffRatePercent<br/>例: 42.5% 変化"]
```

## capture.ts

### captureScreen のフロー

```mermaid
flowchart TD
  A["captureScreen(config)"] --> B["screenshot({ format: 'png' })"]
  B -->|"失敗"| C["{ isOk: false,<br/>errorCode: SCREENSHOT_FAILED }"]
  B -->|"成功: PNG Buffer"| D["buildCapturedImage(buffer, maxWidthPx)<br/>← functional core"]
  D --> E["sharp: resize + ensureAlpha + raw"]
  E --> F["rawPixels (Uint8Array, RGBA)"]
  F --> G["sharp: raw → PNG 再エンコード"]
  G --> H["pngBuffer (Buffer)"]
  D -->|"失敗"| I["{ isOk: false,<br/>errorCode: RESIZE_FAILED }"]
  H -->|"成功"| J["{ isOk: true,<br/>image: CapturedImage }"]
```

### 構造の分離

```mermaid
graph TB
  subgraph shell ["captureScreen (mutable shell)"]
    direction TB
    S1["OS スクリーンショット取得（副作用）"]
    S2["エラーを Result 型に変換"]
    subgraph core ["buildCapturedImage (functional core)"]
      C1["sharp パイプライン（純粋な変換処理）"]
      C2["PNG Buffer → raw pixels → PNG"]
    end
    S1 --> core
    core --> S2
  end
```

## diff.ts

### computeDiff のフロー

```mermaid
flowchart TD
  A["computeDiff(input)"] --> G1{"ガード 1<br/>threshold が有限数かつ<br/>0.0-1.0 の範囲内か？"}
  G1 -->|"No"| E1["{ errorCode: INVALID_THRESHOLD }"]
  G1 -->|"Yes"| G2{"ガード 2<br/>widthPx / heightPx が<br/>ゼロでないか？"}
  G2 -->|"No"| E2["{ errorCode: INVALID_BUFFER_SIZE }"]
  G2 -->|"Yes"| G3{"ガード 3<br/>current と previous の<br/>widthPx / heightPx が一致するか？"}
  G3 -->|"No"| E3["{ errorCode: DIMENSION_MISMATCH }"]
  G3 -->|"Yes"| G4{"ガード 4<br/>バッファのバイト長が<br/>widthPx × heightPx × 4 と一致するか？"}
  G4 -->|"No"| E4["{ errorCode: INVALID_BUFFER_SIZE }"]
  G4 -->|"Yes"| P["pixelmatch(previous, current, w, h, { threshold })"]
  P --> M["mismatchedPixelCount"]
  M --> D["diffRatePercent = mismatchedPixelCount / totalPixelCount × 100"]
  D --> R["{ isOk: true,<br/>diffRatePercent,<br/>mismatchedPixelCount,<br/>totalPixelCount }"]
```

### 2つの threshold の違い

| 名前 | 範囲 | 意味 | 使用箇所 |
|------|------|------|----------|
| `pixelmatchThreshold` | 0.0 - 1.0 | ピクセル単位の色差感度。「2つのピクセルの色がどれくらい違ったら '違う' とみなすか」 | diff.ts が pixelmatch に渡す |
| `diffThresholdPercent` | 例: 5% | 画面全体の変化率の閾値。「画面の何%が変わったら AI に送信するか」 | coach-loop (DCC-06) が判定する |

## 型の関係

```mermaid
graph LR
  subgraph capture ["capture.ts"]
    CI["CapturedImage<br/>- pngBuffer<br/>- rawPixels<br/>- widthPx<br/>- heightPx"]
    CR["CaptureResult<br/>{ isOk: true/false }"]
    CI --> CR
  end

  subgraph diff ["diff.ts"]
    DI["DiffInput<br/>- currentPixels<br/>- currentWidthPx<br/>- currentHeightPx<br/>- previousPixels<br/>- previousWidthPx<br/>- previousHeightPx<br/>- pixelmatchThreshold"]
    DR["DiffResult<br/>{ isOk: true/false }"]
    DI --> DR
  end

  CI -->|"Uint8Array + number<br/>（疎結合）"| DI
```

> ※ diff.ts は capture.ts の型を import しない
> ※ Uint8Array + プリミティブだけで繋がる
