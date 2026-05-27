/**
 * Shape loi chuan tra ve cho client.
 */
export interface ApiError {
  /** Ma loi dang string enum (vd: "ATOM_NOT_FOUND"). */
  code: string;
  /** Message doc duoc cho client. */
  message: string;
  /** Chi tiet bo sung (validation issues, ...). Khong dung `any`, narrow khi can. */
  details?: unknown;
}

/**
 * Metadata kem theo moi response (tracing, pagination, ...).
 */
export interface ApiMeta {
  requestId?: string;
  timestamp: string;
  page?: number;
  pageSize?: number;
  total?: number;
}

/**
 * Shape response thong nhat toan he thong: `{ data, error, meta }`.
 * Thanh cong: data != null, error == null. Loi: nguoc lai.
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta?: ApiMeta;
}

/**
 * Helper type cho response thanh cong (data luon co).
 */
export type ApiSuccess<T> = Omit<ApiResponse<T>, 'data' | 'error'> & {
  data: T;
  error: null;
};
