import screenshot from "screenshot-desktop";
import { describe, expect, test, vi } from "vitest";
import { listDisplays } from "../src/index";

vi.mock("screenshot-desktop", () => ({
  default: {
    listDisplays: vi.fn(),
  },
}));

describe("listDisplays", () => {
  test("数値IDが文字列に正規化される", async () => {
    vi.mocked(screenshot.listDisplays).mockResolvedValueOnce([
      { id: 0, name: "Built-in Display" },
      { id: 1, name: "External Monitor" },
    ]);

    const result = await listDisplays();

    expect(result.isOk).toBe(true);
    if (!result.isOk) return;
    expect(result.displays[0].id).toBe("0");
    expect(result.displays[0].name).toBe("Built-in Display");
    expect(result.displays[1].id).toBe("1");
  });

  test("ライブラリがエラーを返すとLIST_FAILEDを返す", async () => {
    vi.mocked(screenshot.listDisplays).mockRejectedValueOnce(new Error("no displays"));

    const result = await listDisplays();

    expect(result.isOk).toBe(false);
    if (result.isOk) return;
    expect(result.errorCode).toBe("LIST_FAILED");
    expect(result.message).toBe("no displays");
  });
});
