import type { ErrorCode } from "@askpdf/contracts";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Array<{ path: string; issue: string }>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(code: ErrorCode, resource: string): AppError {
  return new AppError(404, code, `The requested ${resource} was not found.`);
}
