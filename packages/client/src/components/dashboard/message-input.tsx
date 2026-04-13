import type { LoopMode } from "@dcc/core";
import { ArrowRight, Loader2, Play } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_IMAGE_TYPES, readFileAsBase64 } from "@/lib/image-file";
import { trpc } from "../../trpc";

type AttachedImage = {
  readonly id: string;
  readonly base64: string;
  readonly fileName: string;
  readonly previewUrl: string;
};

type MessageInputProps = {
  readonly sessionId: string;
  readonly mode: LoopMode;
  // 親 (CoachingFeed) が SSE 経由で同期しているラウンド進行状態。
  // 「次へ進む」のローディング表示と多重押下抑止に使う。
  readonly isRoundPending: boolean;
  readonly onRoundPendingChange: (pending: boolean) => void;
  readonly toolActivityMessage: string | null;
};

const MAX_ATTACHMENTS = 3;

export function MessageInput({
  sessionId,
  mode,
  isRoundPending,
  onRoundPendingChange,
  toolActivityMessage,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [attachedImages, setAttachedImages] = useState<readonly AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMutation = trpc.session.sendMessage.useMutation();
  const nextRoundMutation = trpc.session.requestNextRound.useMutation();

  const canSend = message.trim().length > 0 || attachedImages.length > 0;
  const isAnyPending = sendMutation.isPending || nextRoundMutation.isPending;

  // 下書き/添付があるときは無効化（「次へ進む」は素手で次を催促するボタンのため）。
  // ラウンド進行中（isRoundPending）も多重押下抑止のため無効化する。
  const canRequestNext = !canSend && !isAnyPending && !isRoundPending;

  const handleSubmit = () => {
    if (!canSend) return;

    const trimmed = message.trim();
    sendMutation.mutate(
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

  const handleRequestNextRound = () => {
    if (!canRequestNext) return;
    // クリック直後の即時フィードバック。SSE querying 到着前にローディングを出す。
    // mutation 失敗時は onError で false に戻す。成功時は SSE 側で advice/silent/etc が
    // 流れてくるまで true のままにし、ラウンド完了時に false へ落ちる。
    onRoundPendingChange(true);
    nextRoundMutation.mutate(
      { sessionId },
      {
        onError: () => onRoundPendingChange(false),
      },
    );
  };

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

  // mode に応じて「次へ進む」ボタンの表現を切替（switch で網羅: RULE-006）
  const renderNextRoundButton = () => {
    switch (mode) {
      case "manual":
        return (
          <Button
            type="button"
            onClick={handleRequestNextRound}
            disabled={!canRequestNext}
            className="shrink-0 rounded-xl px-6"
            aria-live="polite"
          >
            {isRoundPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {toolActivityMessage ?? "コーチが応答中..."}
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                次へ進む
              </>
            )}
          </Button>
        );
      case "auto":
        return (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={
              isRoundPending ? (toolActivityMessage ?? "コーチが応答中") : "次のラウンドを即実行"
            }
            title={
              isRoundPending
                ? (toolActivityMessage ?? "コーチが応答中...")
                : "次のラウンドを即実行（タイマーを待たず実行）"
            }
            onClick={handleRequestNextRound}
            disabled={!canRequestNext}
            className="shrink-0 rounded-xl"
          >
            {isRoundPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        );
    }
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
            disabled={sendMutation.isPending}
          >
            📎
          </Button>
        )}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "manual"
              ? "コーチにメッセージを送る。何もなければ「次へ進む」で次ラウンドを開始（⌘+Enter で送信）"
              : "コーチにメッセージを送る（⌘+Enter で送信）"
          }
          className="min-h-[40px] resize-none rounded-xl"
          rows={1}
          disabled={sendMutation.isPending}
        />
        {renderNextRoundButton()}
        <Button
          onClick={handleSubmit}
          disabled={!canSend || sendMutation.isPending}
          className="shrink-0 rounded-xl px-6"
        >
          送信
        </Button>
      </div>
      {(sendMutation.error !== null || nextRoundMutation.error !== null) && (
        <div className="mx-auto max-w-6xl px-6 pb-2">
          <p className="text-sm text-destructive">
            リクエストに失敗しました。セッションが終了している可能性があります。
          </p>
        </div>
      )}
    </div>
  );
}
