import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "../../trpc";

type MessageInputProps = {
  readonly sessionId: string;
};

export function MessageInput({ sessionId }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const mutation = trpc.session.sendMessage.useMutation();

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return;

    mutation.mutate({ sessionId, message: trimmed }, { onSuccess: () => setMessage("") });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="コーチにメッセージを送る（⌘+Enter で送信）"
          className="min-h-[44px] resize-none"
          rows={1}
          disabled={mutation.isPending}
        />
        <Button
          onClick={handleSubmit}
          disabled={message.trim().length === 0 || mutation.isPending}
          className="shrink-0"
        >
          送信
        </Button>
      </div>
      {mutation.error !== null && (
        <p className="text-sm text-destructive">
          メッセージの送信に失敗しました。コーチングセッションが終了している可能性があります。
        </p>
      )}
    </div>
  );
}
