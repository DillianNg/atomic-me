/**
 * Fetch wrapper goi backend @atomic-me/api.
 * - Gan Authorization: Bearer <token> (token lay tu Clerk qua getToken).
 * - Chuan hoa loi theo shape backend tra ve: { error: { code, message, ... } }.
 * - Throw ApiClientError co status + code de caller (vd TanStack Query) xu ly.
 */

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly details: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

export type TokenGetter = () => Promise<string | null>;

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
}

function isErrorEnvelope(value: unknown): value is { error: ApiErrorBody } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'object' &&
    (value as { error: unknown }).error !== null
  );
}

export function createApiClient(baseUrl: string, getToken: TokenGetter): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(`${baseUrl}${path}`, init);

    const text = await res.text();
    const parsed: unknown = text.length > 0 ? JSON.parse(text) : null;

    if (!res.ok) {
      const errorBody: ApiErrorBody = isErrorEnvelope(parsed)
        ? parsed.error
        : { code: 'UNKNOWN', message: res.statusText || 'Request failed' };
      throw new ApiClientError(res.status, errorBody);
    }

    return parsed as T;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
  };
}
