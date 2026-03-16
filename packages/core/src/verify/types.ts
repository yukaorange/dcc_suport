type VerifySuccess = {
  readonly status: "pass";
  readonly name: string;
  readonly durationMs: number;
  readonly detail: string;
};

type VerifyFailure = {
  readonly status: "fail";
  readonly name: string;
  readonly durationMs: number;
  readonly error: string;
  readonly fallback: string;
};

type VerifyInconclusive = {
  readonly status: "inconclusive";
  readonly name: string;
  readonly durationMs: number;
  readonly reason: string;
};

export type VerifyResult = VerifySuccess | VerifyFailure | VerifyInconclusive;

export function printVerifyResult(r: VerifyResult): void {
  switch (r.status) {
    case "pass":
      console.log(`PASS: ${r.name} (${Math.round(r.durationMs)}ms) — ${r.detail}`);
      break;
    case "fail":
      console.log(`FAIL: ${r.name} (${Math.round(r.durationMs)}ms) — ${r.error}`);
      break;
    case "inconclusive":
      console.log(`INCONCLUSIVE: ${r.name} (${Math.round(r.durationMs)}ms) — ${r.reason}`);
      break;
  }
}
