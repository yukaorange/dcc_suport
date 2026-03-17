import type { Plan } from "@dcc/core";

type PendingPlan = {
  readonly plan: Plan;
  readonly referenceImagePath: string;
  readonly goalDescription: string;
};

type PendingPlanCache = {
  readonly set: (id: string, pending: PendingPlan) => void;
  readonly get: (id: string) => PendingPlan | null;
  readonly delete: (id: string) => void;
};

export type { PendingPlan, PendingPlanCache };

export function createPendingPlanCache(): PendingPlanCache {
  const cache = new Map<string, PendingPlan>();
  return {
    set: (id, pending) => {
      cache.set(id, pending);
    },
    get: (id) => cache.get(id) ?? null,
    delete: (id) => {
      cache.delete(id);
    },
  };
}
