export type CoachConfig = {
  readonly intervalSeconds: number;
  readonly diffThresholdPercent: number;
  readonly maxImageWidthPx: number;
  readonly pixelmatchThreshold: number;
  readonly dashboard: {
    readonly isEnabled: boolean;
    readonly port: number;
  };
};

export const defaultConfig: CoachConfig = {
  intervalSeconds: 5,
  diffThresholdPercent: 5,
  maxImageWidthPx: 1280,
  pixelmatchThreshold: 0.1,
  dashboard: {
    isEnabled: true,
    port: 3456,
  },
};
