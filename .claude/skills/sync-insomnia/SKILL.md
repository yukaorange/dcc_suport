---
name: sync-insomnia
description: 現在のAPI設計を調査し、Insomnia Import Dataを作成
disable-model-invocation: true
---

# Task

下記のSTEPの手順で、InsomniaにインポートできるJSONデータを作成して。

STEP

1. @packages/api/src/app.ts を起点に関連ファイルを読み込んだ上でAPI設計を調査し、完全なAPIスキーマを把握する
2. @insomnia.json をReadFileし、調査したスキーマをもとに必要な差分を追記する

NOTE

* REQUIREMENT: APIコレクションはエンドポイント、入出力ともに完全であること
* ALWAYS: ./insomnia.jsonを確認し、調査したスキーマをもとに必要な差分を追記すること
