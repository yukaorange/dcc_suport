import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const REFERENCE_DIR = join(process.cwd(), ".coach-tmp", "references");
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"];
const IMAGE_MAGIC_BYTES: Record<string, readonly number[]> = {
  ".png": [0x89, 0x50, 0x4e, 0x47],
  ".jpg": [0xff, 0xd8, 0xff],
  ".jpeg": [0xff, 0xd8, 0xff],
  ".webp": [0x52, 0x49, 0x46, 0x46],
};

type SaveImageResult =
  | { readonly isOk: true; readonly filePath: string }
  | { readonly isOk: false; readonly message: string };

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export async function saveBase64Image(base64: string, fileName: string): Promise<SaveImageResult> {
  const ext = extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { isOk: false, message: `対応していない画像形式: ${ext}` };
  }

  const buffer = Buffer.from(base64, "base64");

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return { isOk: false, message: "画像サイズが上限(10MB)を超えています" };
  }

  const expected = IMAGE_MAGIC_BYTES[ext];
  if (expected !== undefined) {
    const isValidHeader = expected.every((byte, i) => buffer[i] === byte);
    if (!isValidHeader) {
      return { isOk: false, message: `ファイル内容が${ext}形式と一致しません` };
    }
  }

  await mkdir(REFERENCE_DIR, { recursive: true });
  const sanitized = sanitizeFileName(fileName);
  const filePath = join(REFERENCE_DIR, `${crypto.randomUUID()}_${sanitized}`);
  await writeFile(filePath, buffer);

  return { isOk: true, filePath };
}
