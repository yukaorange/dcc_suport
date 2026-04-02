import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCEPTED_IMAGE_TYPES, readFileAsBase64 } from "@/lib/image-file";

type ReferenceImage = {
  readonly id: string;
  readonly base64: string;
  readonly fileName: string;
  readonly previewUrl: string;
  readonly label: string;
};

type ReferenceUploaderProps = {
  readonly images: readonly ReferenceImage[];
  readonly onImagesChanged: (images: readonly ReferenceImage[]) => void;
  readonly maxImageCount?: number;
};

export type { ReferenceImage };

const DEFAULT_MAX_COUNT = 5;

export function ReferenceUploader({
  images,
  onImagesChanged,
  maxImageCount = DEFAULT_MAX_COUNT,
}: ReferenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canAddMore = images.length < maxImageCount;

  const processFiles = async (files: FileList) => {
    setErrorMessage(null);
    const remaining = maxImageCount - images.length;
    if (remaining <= 0) {
      setErrorMessage(`画像は最大${maxImageCount}枚までです`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    const newImages: ReferenceImage[] = [];

    for (const file of filesToProcess) {
      const result = await readFileAsBase64(file);
      if (!result.isOk) {
        setErrorMessage(result.message);
        return;
      }
      newImages.push({
        id: crypto.randomUUID(),
        base64: result.image.base64,
        fileName: result.image.fileName,
        previewUrl: result.image.previewUrl,
        label: "",
      });
    }

    onImagesChanged([...images, ...newImages]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files !== null && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleLabelChanged = (imageId: string, newLabel: string) => {
    onImagesChanged(images.map((img) => (img.id === imageId ? { ...img, label: newLabel } : img)));
  };

  const handleRemoveImage = (imageId: string) => {
    onImagesChanged(images.filter((img) => img.id !== imageId));
  };

  return (
    <div className="space-y-3">
      <Label>参考画像をアップロード（最大{maxImageCount}枚）</Label>

      {canAddMore && (
        <Card
          className={`flex min-h-[120px] cursor-pointer items-center justify-center border-2 border-dashed p-4 transition-colors ${
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
          <p className="text-sm text-muted-foreground">
            ここに画像をドラッグ&ドロップ、またはクリックして選択
          </p>
        </Card>
      )}

      {errorMessage !== null && <p className="text-sm text-destructive">{errorMessage}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <Card key={img.id} className="relative overflow-hidden p-2">
              <img
                src={img.previewUrl}
                alt={img.label || img.fileName}
                className="mb-2 h-24 w-full rounded object-cover"
              />
              <Input
                value={img.label}
                onChange={(e) => handleLabelChanged(img.id, e.target.value)}
                placeholder="ラベル（例: 配色参考）"
                className="mb-1 h-7 text-xs"
                maxLength={50}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-6 w-6 rounded-full p-0 text-xs"
                onClick={() => handleRemoveImage(img.id)}
              >
                ×
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
