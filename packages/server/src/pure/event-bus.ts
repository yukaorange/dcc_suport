import type { LoopEvent } from "@dcc/core";

type TaggedLoopEvent = LoopEvent & { readonly sessionId: string };
type EventListener = (event: TaggedLoopEvent) => void;

type EventBus = {
  readonly subscribe: (listener: EventListener) => () => void;
  readonly publish: (event: TaggedLoopEvent) => void;
};

export type { EventBus, TaggedLoopEvent };

export function createEventBus(): EventBus {
  const listeners = new Set<EventListener>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (event) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}
