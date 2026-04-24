// クリップボード（paste イベント）から貼付された画像ファイルを抽出する純粋関数。
// UI のイベント処理と切り離して出力値ベーステストできるようにするため分離している。

export function extractImageFilesFromClipboard(data: DataTransfer): File[] {
  const result: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file === null) continue;
    result.push(ensureNamedImageFile(file, result.length));
  }
  return result;
}

function ensureNamedImageFile(file: File, index: number): File {
  // クリップボード経由の画像は file.name が空や "image.png" 固定のことがあるため、
  // 一覧内で識別できるよう貼付時刻で命名し直す
  const hasMeaningfulName = file.name !== "" && file.name !== "image.png";
  if (hasMeaningfulName) return file;
  const extension = file.type.split("/")[1] ?? "png";
  return new File([file], `pasted-${Date.now()}-${index}.${extension}`, { type: file.type });
}
