import { unlink } from "node:fs/promises";
import type { Plan } from "@dcc/core";

const TTL_MS = 30 * 60 * 1000;

type PendingPlan = {
  readonly plan: Plan;
  readonly referenceImages: readonly { readonly path: string; readonly label: string }[];
  readonly goalDescription: string;
};

type CacheEntry = {
  readonly pending: PendingPlan;
  readonly expiresAt: number;
};

type PendingPlanCache = {
  readonly set: (id: string, pending: PendingPlan) => void;
  readonly get: (id: string) => PendingPlan | null;
  readonly delete: (id: string) => void;
};

export type { PendingPlan, PendingPlanCache };

function cleanupImages(pending: PendingPlan): void {
  for (const img of pending.referenceImages) {
    unlink(img.path).catch(() => {});
  }
}

export function createPendingPlanCache(): PendingPlanCache {
  const cache = new Map<string, CacheEntry>();

  function evictExpired() {
    const now = Date.now();
    for (const [id, entry] of cache) {
      if (entry.expiresAt <= now) {
        cleanupImages(entry.pending);
        cache.delete(id);
      }
    }
  }

  return {
    set: (id, pending) => {
      evictExpired();
      cache.set(id, { pending, expiresAt: Date.now() + TTL_MS });
    },
    get: (id) => {
      const entry = cache.get(id);
      if (entry === undefined) return null;
      if (entry.expiresAt <= Date.now()) {
        cleanupImages(entry.pending);
        cache.delete(id);
        return null;
      }
      return entry.pending;
    },
    delete: (id) => {
      cache.delete(id);
    },
  };
}
