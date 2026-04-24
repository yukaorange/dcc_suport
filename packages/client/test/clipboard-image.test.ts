import { describe, expect, it } from "vitest";
import { extractImageFilesFromClipboard } from "../src/lib/clipboard-image";

type MockItem = {
  readonly kind: string;
  readonly type: string;
  readonly file: File | null;
};

function buildClipboard(items: readonly MockItem[]): DataTransfer {
  const dataTransferItems = items.map((item) => ({
    kind: item.kind,
    type: item.type,
    getAsFile: () => item.file,
  }));
  return {
    items: dataTransferItems as unknown as DataTransferItemList,
  } as DataTransfer;
}

function makeImageFile(name: string, type = "image/png"): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type });
}

describe("extractImageFilesFromClipboard", () => {
  it("returns image files pasted from clipboard", () => {
    const file = makeImageFile("screenshot.png");
    const result = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "file", type: "image/png", file }]),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("screenshot.png");
    expect(result[0]?.type).toBe("image/png");
  });

  it("renames files whose name is an empty string", () => {
    const file = makeImageFile("", "image/png");
    const [renamed] = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "file", type: "image/png", file }]),
    );

    expect(renamed?.name).toMatch(/^pasted-\d+-0\.png$/);
    expect(renamed?.type).toBe("image/png");
  });

  it('renames files whose name is the generic "image.png"', () => {
    // macOS のスクショなど、クリップボード貼付で name が "image.png" 固定になるケース
    const file = makeImageFile("image.png");
    const [renamed] = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "file", type: "image/png", file }]),
    );

    expect(renamed?.name).toMatch(/^pasted-\d+-0\.png$/);
  });

  it("preserves files that already have a meaningful name", () => {
    const file = makeImageFile("diagram.webp", "image/webp");
    const [preserved] = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "file", type: "image/webp", file }]),
    );

    expect(preserved).toBe(file);
    expect(preserved?.name).toBe("diagram.webp");
  });

  it("derives the extension from the mime type when renaming", () => {
    const file = makeImageFile("", "image/jpeg");
    const [renamed] = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "file", type: "image/jpeg", file }]),
    );

    expect(renamed?.name).toMatch(/^pasted-\d+-0\.jpeg$/);
  });

  it("disambiguates multiple unnamed pastes via index", () => {
    const first = makeImageFile("", "image/png");
    const second = makeImageFile("image.png");
    const result = extractImageFilesFromClipboard(
      buildClipboard([
        { kind: "file", type: "image/png", file: first },
        { kind: "file", type: "image/png", file: second },
      ]),
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toMatch(/^pasted-\d+-0\.png$/);
    expect(result[1]?.name).toMatch(/^pasted-\d+-1\.png$/);
    expect(result[0]?.name).not.toBe(result[1]?.name);
  });

  it("ignores non-file items such as plain text", () => {
    // 「⌘+V でテキストを貼った時にテキスト貼付が阻害されない」ための保証
    const result = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "string", type: "text/plain", file: null }]),
    );

    expect(result).toEqual([]);
  });

  it("ignores file items whose mime is not an image", () => {
    const pdf = new File([new Uint8Array()], "report.pdf", { type: "application/pdf" });
    const result = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "file", type: "application/pdf", file: pdf }]),
    );

    expect(result).toEqual([]);
  });

  it("skips items whose getAsFile returns null", () => {
    const result = extractImageFilesFromClipboard(
      buildClipboard([{ kind: "file", type: "image/png", file: null }]),
    );

    expect(result).toEqual([]);
  });

  it("returns only image files when mixed with text items", () => {
    const image = makeImageFile("shot.png");
    const result = extractImageFilesFromClipboard(
      buildClipboard([
        { kind: "string", type: "text/plain", file: null },
        { kind: "file", type: "image/png", file: image },
        { kind: "string", type: "text/html", file: null },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("shot.png");
  });
});
