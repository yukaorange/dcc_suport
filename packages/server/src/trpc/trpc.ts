import { initTRPC } from "@trpc/server";
import type { AppContext } from "./context";

// SSE の keepalive 設定: 一時停止中など無通信状態が続くと Bun の idleTimeout や
// 中継層で SSE が切断されるため、tRPC 組込みの ping で 30 秒ごとに通信を流す。
// client の httpSubscriptionLink は ping event を内部処理し onData に流さないので
// domain の TaggedLoopEvent 型を汚さずに済む。
const t = initTRPC.context<AppContext>().create({
  sse: {
    ping: {
      enabled: true,
      intervalMs: 30_000,
    },
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
