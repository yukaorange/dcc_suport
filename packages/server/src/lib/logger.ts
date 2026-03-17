type LogEntry = {
  readonly tag: string;
  readonly message: string;
  readonly durationMs?: number;
};

function formatLog(entry: LogEntry): string {
  const timestamp = new Date().toISOString();
  const duration = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : "";
  return `[${timestamp}] [${entry.tag}] ${entry.message}${duration}`;
}

function createTaggedLogger(tag: string) {
  const startMs = Date.now();
  return {
    started: () => {
      console.log(formatLog({ tag, message: "started" }));
    },
    completed: () => {
      console.log(formatLog({ tag, message: "completed", durationMs: Date.now() - startMs }));
    },
    failed: (reason: string) => {
      console.error(formatLog({ tag, message: `failed: ${reason}`, durationMs: Date.now() - startMs }));
    },
    info: (message: string) => {
      console.log(formatLog({ tag, message }));
    },
  };
}

export { createTaggedLogger };
