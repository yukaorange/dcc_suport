export type CoachConfig = {
  readonly intervalSeconds: number;
  readonly diffThresholdPercent: number;
  readonly maxImageWidth: number;
  readonly dashboard: {
    readonly isEnabled: boolean;
    readonly port: number;
  };
};

export const defaultConfig: CoachConfig = {
  intervalSeconds: 5,
  diffThresholdPercent: 5,
  maxImageWidth: 1280,
  dashboard: {
    isEnabled: true,
    port: 3456,
  },
};
