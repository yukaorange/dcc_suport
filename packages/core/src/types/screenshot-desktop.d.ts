declare module "screenshot-desktop" {
  type ScreenshotOptions = {
    readonly format?: "png" | "jpg";
    readonly screen?: number;
    readonly filename?: string;
  };

  type Display = {
    readonly id: number;
    readonly name: string;
  };

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;

  namespace screenshot {
    function listDisplays(): Promise<Display[]>;
    function all(): Promise<Buffer[]>;
  }

  // biome-ignore lint/style/noDefaultExport: screenshot-desktop は CJS の default export のみ提供するライブラリ
  export default screenshot;
}
