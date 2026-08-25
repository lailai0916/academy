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
  const responseText = await response.text();
  let payload: T | ApiError | undefined;
  try {
    payload = responseText ? (JSON.parse(responseText) as T | ApiError) : undefined;
  } catch {
    throw new ApiRequestError(response.status, { error: '服务响应异常，请稍后重试。' });
  }
  if (!response.ok) {
    const apiError = payload as ApiError | undefined;
    throw new ApiRequestError(response.status, {
      error: apiError?.error || '服务暂时不可用，请稍后重试。',
      details: apiError?.details,
    });
  }
  return payload as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}
