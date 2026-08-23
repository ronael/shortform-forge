export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hint?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(error.message, "UNEXPECTED_ERROR");
  return new AppError(String(error), "UNEXPECTED_ERROR");
}
