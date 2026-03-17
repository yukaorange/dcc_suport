import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/tiff", "image/bmp"];

type ReferenceUploaderProps = {
  readonly onFileSelected: (base64: string, fileName: string) => void;
  readonly previewUrl: string | null;
};

export function ReferenceUploader({ onFileSelected, previewUrl }: ReferenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processFile = (file: File) => {
    setErrorMessage(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMessage("対応していない画像形式です");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("ファイルサイズが10MBを超えています");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      const base64 = result.split(",")[1] ?? "";
      onFileSelected(base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file !== undefined) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file !== undefined) processFile(file);
  };

  return (
    <div className="space-y-2">
      <Label>参考画像をアップロード</Label>
      <Card
        className={`flex min-h-[160px] cursor-pointer items-center justify-center border-2 border-dashed p-4 transition-colors ${
          isDragging ? "border-primary bg-accent" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl !== null ? (
          <img
            src={previewUrl}
            alt="参考画像プレビュー"
            className="max-h-[300px] rounded object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            ここに画像をドラッグ&ドロップ、またはクリックして選択
          </p>
        )}
      </Card>
      {errorMessage !== null && <p className="text-sm text-destructive">{errorMessage}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
      />
      {previewUrl !== null && (
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          画像を変更
        </Button>
      )}
    </div>
  );
}
