const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/tiff", "image/bmp"];

type ProcessedImage = {
  readonly base64: string;
  readonly fileName: string;
  readonly previewUrl: string;
};

type ProcessImageResult =
  | { readonly isOk: true; readonly image: ProcessedImage }
  | { readonly isOk: false; readonly message: string };

export type { ProcessedImage, ProcessImageResult };

function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "対応していない画像形式です（PNG, JPEG, WebP, TIFF, BMP）";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "ファイルサイズが10MBを超えています";
  }
  return null;
}

function readFileAsBase64(file: File): Promise<ProcessImageResult> {
  const error = validateImageFile(file);
  if (error !== null) {
    return Promise.resolve({ isOk: false, message: error });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        resolve({ isOk: false, message: "ファイルの読み込みに失敗しました" });
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      const previewUrl = result;
      resolve({
        isOk: true,
        image: { base64, fileName: file.name, previewUrl },
      });
    };
    reader.onerror = () => {
      resolve({ isOk: false, message: "ファイルの読み込みに失敗しました" });
    };
    reader.readAsDataURL(file);
  });
}

export { readFileAsBase64, validateImageFile, ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES };
