/**
 * Loi nghiep vu chuan cua API. Khong throw raw Error: dung AppError de co
 * code (string enum) + statusCode + details, error-handler se format thong nhat.
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 Bad Request: input khong hop le. */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/** 401 Unauthorized: thieu hoac sai credential. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

/** 403 Forbidden: da xac thuc nhung khong du quyen. */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

/** 404 Not Found: resource khong ton tai. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/** 409 Conflict: trang thai mau thuan (vd unique constraint). */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

/** 429 Too Many Requests: vuot rate limit. */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(message, 'RATE_LIMITED', 429, details);
  }
}

/** 500 Internal Server Error: loi khong luong truoc. */
export class InternalError extends AppError {
  constructor(message = 'Internal Server Error', details?: unknown) {
    super(message, 'INTERNAL_ERROR', 500, details);
  }
}

/** Type guard: kiem tra mot gia tri co phai AppError khong. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
