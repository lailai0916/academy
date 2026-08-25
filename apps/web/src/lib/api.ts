import type { ApiError } from '@lailai/academy-shared';

export class ApiRequestError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(status: number, payload: ApiError) {
    super(payload.error);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = payload.details;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json()) as T | ApiError;
  if (!response.ok) {
    throw new ApiRequestError(response.status, payload as ApiError);
  }
  return payload as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}
