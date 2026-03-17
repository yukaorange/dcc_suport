import { expect, test } from "@playwright/test";

test.describe("スモークテスト", () => {
  test("Setup画面が表示される", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toHaveText("DCC Coach");
    await expect(page.locator("text=セットアップ")).toBeVisible();
  });

  test("Sessionsナビゲーションボタンが存在する", async ({ page }) => {
    await page.goto("/");

    const sessionsButton = page.locator("nav button", { hasText: "Sessions" });
    await expect(sessionsButton).toBeVisible();
  });

  test("ディスプレイ一覧がサーバーから取得される", async ({ page }) => {
    await page.goto("/");

    // Select トリガーが表示される（読み込み完了を待つ）
    const selectTrigger = page.locator("text=ディスプレイを選択");
    await expect(selectTrigger).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("ナビゲーション", () => {
  test("Setup → Sessions → Setup の画面遷移", async ({ page }) => {
    await page.goto("/");

    // Setup画面にいることを確認
    await expect(page.locator("text=セットアップ")).toBeVisible();

    // Sessionsに遷移
    await page.click("nav button:has-text('Sessions')");

    // セッション画面: 一覧（h2）、空メッセージ、ローディングのいずれかが表示される
    await expect(
      page
        .locator("text=セッション一覧")
        .or(page.locator("text=まだセッションがありません"))
        .or(page.locator("text=読み込み中")),
    ).toBeVisible({ timeout: 10_000 });

    // Setupに戻る
    await page.click("nav button:has-text('Setup')");
    await expect(page.locator("text=セットアップ")).toBeVisible();
  });

  test("セッション画面が表示される", async ({ page }) => {
    await page.goto("/");
    await page.click("nav button:has-text('Sessions')");

    // セッション画面のいずれかのコンテンツが表示されればOK
    // （一覧 or 空メッセージ or ローディング or エラー）
    await expect(
      page
        .locator("text=セッション一覧")
        .or(page.locator("text=まだセッションがありません"))
        .or(page.locator("text=読み込み中"))
        .or(page.locator("text=セッションの取得に失敗しました")),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("フォームバリデーション", () => {
  test("目標が5文字未満のとき警告が表示される", async ({ page }) => {
    await page.goto("/");

    const textarea = page.locator("textarea");
    await textarea.fill("テスト");

    await expect(page.locator("text=5文字以上で入力してください")).toBeVisible();
  });

  test("目標が5文字以上のとき警告が消える", async ({ page }) => {
    await page.goto("/");

    const textarea = page.locator("textarea");
    await textarea.fill("テスト");
    await expect(page.locator("text=5文字以上で入力してください")).toBeVisible();

    await textarea.fill("テストの目標です");
    await expect(page.locator("text=5文字以上で入力してください")).not.toBeVisible();
  });

  test("必須項目が未入力の場合、プラン生成ボタンがdisabledになる", async ({ page }) => {
    await page.goto("/");

    const generateButton = page.locator("button", { hasText: "プランを生成" });
    await expect(generateButton).toBeDisabled();
  });
});
