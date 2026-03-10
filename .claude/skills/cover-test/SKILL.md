---
name: cover-test
description: テストケースをdiffをもとにアップデート
disable-model-invocation: false
---

# テスト

task:現在の実装内容をもとに、既存のテストケースをアップデートする

**ultrathink**
拡張思考を行いなさい。

## STEP 1

!`git diff origin/main` を実行

## STEP 2

(1)に関連する既存のテストケースを読み込み、熟読する。
また、diffに関連する実装ファイルも改めてすべて読み込むこと。

テストケースを実装するに足りる確信を得るまで続けること。

## STEP 3

今回の変更によって、追加/変更すべきテストケース案を検討する。

指針

* テストケース名は、最終的にユーザ(またはモジュール利用者)に見える振る舞いを日本語で記述する
* テストケースは、exportされた関数のみに対して行う
* ユニットテストの場合:
  * モック使用禁止 (fake timer, randomを除く)
  * 正常系、異常系を過不足なくカバー
* 統合テストの場合:
  * モック使用可
  * happy-pathのテストのみ

## STEP 4

ユーザにSTEP3の要点を提示して、フィードバックまたは許可を求める。
明示的な許可を得るまで続ける。

## STEP 5

テストケースの変更を行う。

* NEVER: 既存の実装ファイルの書き換えは絶対禁止
* Arrange / Act / Assertに分けて、それぞれ空行を1つ空けて記述
* モック利用の場合、module mockを行う
* ユニットテストの場合:
  * モック使用禁止 (fake timer, randomを除く)
  * 正常系、異常系を過不足なくカバー
* 統合テストの場合:
  * モック使用可
  * happy-pathのテストのみ
  * React Componentに対しては、`vitest browser mode`を使用する。(必ずドキュメントをWebSearch Toolで検索すること！)

## STEP 6: codex によるテストレビュー

STEP5のテスト実装後、codex にテストコードをレビューさせる。
codex を呼ぶときは timeout を延長すること。(7分以上を推奨)

```bash
codex exec -m gpt-5.4 "このテストコードをレビューして。瑣末な点への不要なリプライはするな。致命的な点への指摘に尽力せよ。観点: (1)テストが実際に対象の振る舞いを検証できているか (2)エッジケースの見落とし (3)実装詳細への過度な依存(リファクタリング耐性) : $(git diff origin/main -- '**/tests/**') (ref: CLAUDE.md, .claude/rules/coderule.md, .claude/rules/convention.md)"
```

* codex の指摘があればユーザーに報告する。修正するかどうかはユーザーが判断する
* codex の指摘がなければ「追加の問題は検出されなかった」と報告して完了
ï