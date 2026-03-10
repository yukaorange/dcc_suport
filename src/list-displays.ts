import screenshot from "screenshot-desktop";

type DisplayInfo = {
  readonly id: string;
  readonly name: string;
};

type ListDisplaysSuccess = { readonly isOk: true; readonly displays: readonly DisplayInfo[] };
type ListDisplaysFailure = {
  readonly isOk: false;
  readonly errorCode: "LIST_FAILED";
  readonly message: string;
};
type ListDisplaysResult = ListDisplaysSuccess | ListDisplaysFailure;

export type { DisplayInfo, ListDisplaysResult };

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function listDisplays(): Promise<ListDisplaysResult> {
  // @throws — OS レベルのディスプレイ列挙失敗
  const displays = await screenshot.listDisplays().catch((e: unknown) => e);
  if (!Array.isArray(displays)) {
    return {
      isOk: false,
      errorCode: "LIST_FAILED",
      message: toErrorMessage(displays),
    };
  }
  return { isOk: true, displays };
}
