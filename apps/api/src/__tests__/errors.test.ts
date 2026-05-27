import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  isAppError,
} from '../lib/errors.js';

const cases: Array<[AppError, string, number]> = [
  [new ValidationError(), 'VALIDATION_ERROR', 400],
  [new UnauthorizedError(), 'UNAUTHORIZED', 401],
  [new ForbiddenError(), 'FORBIDDEN', 403],
  [new NotFoundError(), 'NOT_FOUND', 404],
  [new ConflictError(), 'CONFLICT', 409],
  [new RateLimitError(), 'RATE_LIMITED', 429],
  [new InternalError(), 'INTERNAL_ERROR', 500],
];

describe('error classes', () => {
  it.each(cases)('has correct code and statusCode', (err, code, statusCode) => {
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.statusCode).toBe(statusCode);
    expect(isAppError(err)).toBe(true);
  });

  it('carries details when provided', () => {
    const err = new ValidationError('bad', { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });

  it('leaves details undefined when omitted', () => {
    expect(new NotFoundError().details).toBeUndefined();
  });

  it('sets name to the subclass name', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
  });

  it('isAppError is false for non-AppError values', () => {
    expect(isAppError(new Error('x'))).toBe(false);
    expect(isAppError('nope')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
