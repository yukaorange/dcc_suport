import { Play } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_IMAGE_TYPES, readFileAsBase64 } from "@/lib/image-file";
import { trpc } from "../../trpc";

// 「できました」「完了」等のステップ進捗を示唆する語は避ける（ステップ進捗を動かさないため）
const NEXT_INSTRUCTION_MESSAGE = "やりました、次の指示をもらえますか？";

type AttachedImage = {
  readonly id: string;
  readonly base64: string;
  readonly fileName: string;
  readonly previewUrl: string;
};

type MessageInputProps = {
  readonly sessionId: string;
  readonly isPaused: boolean;
};

const MAX_ATTACHMENTS = 3;

export function MessageInput({ sessionId, isPaused }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [attachedImages, setAttachedImages] = useState<readonly AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mutation = trpc.session.sendMessage.useMutation();

  const canSend = message.trim().length > 0 || attachedImages.length > 0;

  const handleSubmit = () => {
    if (!canSend) return;

    const trimmed = message.trim();
    mutation.mutate(
      {
        sessionId,
        message: trimmed.length > 0 ? trimmed : undefined,
        images:
          attachedImages.length > 0
            ? attachedImages.map((img) => ({ base64: img.base64, fileName: img.fileName }))
            : undefined,
      },
      {
        onSuccess: () => {
          setMessage("");
          setAttachedImages([]);
        },
      },
    );
  };

  // ステップ内のミクロ操作を1つこなしたあと、次の指示をコーチに即催促する
  const handleRequestNextInstruction = () => {
    if (mutation.isPending) return;
    mutation.mutate({ sessionId, message: NEXT_INSTRUCTION_MESSAGE });
  };

  // 下書き/添付があるときは無効化（クイックボタンはあくまで「素手で次を催促」用途）
  const canRequestNext = !canSend && !mutation.isPending;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files === null || e.target.files.length === 0) return;

    const remaining = MAX_ATTACHMENTS - attachedImages.length;
    const filesToProcess = Array.from(e.target.files).slice(0, remaining);
    const newImages: AttachedImage[] = [];

    for (const file of filesToProcess) {
      const result = await readFileAsBase64(file);
      if (result.isOk) {
        newImages.push({
          id: crypto.randomUUID(),
          base64: result.image.base64,
          fileName: result.image.fileName,
          previewUrl: result.image.previewUrl,
        });
      }
    }

    setAttachedImages([...attachedImages, ...newImages]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setAttachedImages(attachedImages.filter((img) => img.id !== imageId));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      {attachedImages.length > 0 && (
        <div className="mx-auto flex max-w-6xl gap-2 px-6 pt-3">
          {attachedImages.map((img) => (
            <div key={img.id} className="relative">
              <img
                src={img.previewUrl}
                alt={img.fileName}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                type="button"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
                onClick={() => handleRemoveImage(img.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        {attachedImages.length < MAX_ATTACHMENTS && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-xl px-3"
            onClick={() => fileInputRef.current?.click()}
            disabled={mutation.isPending}
          >
            📎
          </Button>
        )}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isPaused
              ? "メッセージを送信するとコーチングが再開します（⌘+Enter で送信）"
              : "コーチにメッセージを送る（⌘+Enter で送信）"
          }
          className="min-h-[40px] resize-none rounded-xl"
          rows={1}
          disabled={mutation.isPending}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="次の指示をもらう"
          title="次の指示をもらう（下書き・添付があるときは無効）"
          onClick={handleRequestNextInstruction}
          disabled={!canRequestNext}
          className="shrink-0 rounded-xl"
        >
          <Play className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSend || mutation.isPending}
          className="shrink-0 rounded-xl px-6"
        >
          送信
        </Button>
      </div>
      {mutation.error !== null && (
        <div className="mx-auto max-w-6xl px-6 pb-2">
          <p className="text-sm text-destructive">
            メッセージの送信に失敗しました。コーチングセッションが終了している可能性があります。
          </p>
        </div>
      )}
    </div>
  );
}
