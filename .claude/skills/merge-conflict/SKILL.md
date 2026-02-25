---
name: merge-conflict
description: コンフリクトしたブランチを自動マージ
disable-model-invocation: true
---

# Task

**UltraThink**
現在、トピックブランチにいて、mainブランチとはコンフリクト状態にある。
mainブランチをmergeし、それぞれのブランチの作業を理解したうえでコンフリクトを安全に解消し、merge commitを行うこと。

## Step 1

`git status -sb`を実行し、作業ブランチにいることを確認

## Step 2

`git fetch origin` を実行した後、`git merge origin/main`を実行

## Step 3

* `git diff`で競合状態を確認
* `git log`や、`git blame`を使い、変更内容を把握
* 関連するファイルをRead

LOOP: それぞれのブランチの作業意図、変更意図を完全に理解し、安全なマージが行えることを十分に確信するまで続けること

## Step 4

「それぞれのブランチの変更」および、「マージ作業の概要」、「なぜこのマージが安全か」をユーザに提示する

LOOP: ユーザに許可もしくはフィードバックを求め、明示的に許可を得るまで続ける。

## Step 5

実際に、ファイルのgit競合マーカーを編集し解消を行う。

LOOP: `git status`を使い、すべての競合マーカーがなくなったことを確認する。

## Step 6

* `bun run typecheck`
* `bun run lint`
* `bun run test`

などを行い、マージ品質をチェックする。
(コマンドが存在しなければ、package.jsonで他の定義がないかチェックする)

## Step 7

`git commit -m resolve merge conflicts`としてコンフリクト解消コミットを行う

その後、ユーザにgit pushを行うことを求める。
