---
name: git-worktree
description: >
  Git worktreeを使って並行作業環境を分離する。複数タスクの同時実行時、
  別ブランチでの並行作業時に使用する。ユーザーが「worktreeで」
  「別ブランチで作業」「並行して」と言及した場合にトリガーする。
  ブランチ名はLinear連携のissue ID（SCR-XXX形式）を使用する。
---

# Git Worktree による並行作業分離

## 概要

mainブランチから複数のworktreeを作成し、独立した兄弟ディレクトリで並行作業を行う。
マージ、ブランチ削除、worktreeの削除はユーザーが手動で判断するため、このスキルでは行わない。

## ワークフロー

### 1. GitHub issueからSCR-XXを特定する

`gh issue list` でissue一覧を取得し、ユーザーの指示内容に合致するissueを探す。

```bash
gh issue list
```

出力例：

```txt
#8  SCR-16 : GitHub リポジトリ設定・CI パイプライン          about 1 day ago
#7  SCR-15 : フロントエンド初期セットアップ                  about 1 day ago
```

- タイトルは `SCR-XX : タスク名` の形式
- ユーザーの指示内容とissueタイトルを照合し、該当するSCR-XXを特定する
- **該当するissueが存在しない場合は作業を中断し、ユーザーに警告する。worktreeの作成やブランチの作成は行わない。**

### 2. 既存worktreeの確認

```bash
git worktree list
```

- **該当ブランチのworktreeが既に存在する場合**: そのディレクトリに `cd` するだけ。ステップ3は不要。
- **存在しない場合**: 次のステップへ進む。

### 3. worktree作成（既存がない場合のみ）

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_PARENT=$(dirname "$REPO_ROOT")
BRANCH="SCR-16"

git worktree add -b "$BRANCH" "$REPO_PARENT/$BRANCH" main
```

### 4. worktreeでの作業

```bash
cd "$REPO_PARENT/$BRANCH"
# 通常のgit操作（commit, push等）が可能
```

## 注意事項

- 同じブランチを複数のworktreeでチェックアウトできない
- PRのマージ完了後、worktreeの削除、ブランチの削除はユーザーが手動で行う：

  ```bash
  # worktreeの削除
  git worktree remove ../SCR-16
  
  # ブランチの削除
  git branch -d SCR-16

  ```
