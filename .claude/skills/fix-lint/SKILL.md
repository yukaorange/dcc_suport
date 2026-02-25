---
name: fix-lint
description: lintエラーを修正
disable-model-invocation: false
---

# Task

ユーザに聞いた方針をもとに、lintエラーを修正する。

## STEP 1

`bun run lint`を実行し、lint結果を得る

## STEP 2

望ましいと考えられるlintエラーへの対応（具体的な変更後コード）を検討。
それぞれ、lintの種別やコードの場所ごとにまとめ、ユーザに対応方針を完結に提示。

ユーザにフィードバックまたは許可を求める。
フィードバックがあればプランを修正すること。

## STEP 3

STEP2で許可されたプランをもとにコードを修正し、lintを修正する。

## STEP 4

最後に、`bun run lint`を実行する。
エラーがまだ出ている場合、STEP 2に戻り再度修正作業を行う。
