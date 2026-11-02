// Small JSON helpers for the dashboard
export async function api<T = { ok: boolean; error?: string }>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  try {
    const r = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await r.json()) as T;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) } as T;
  }
}

export const patchSettings = (patch: unknown) => api('/api/settings', patch, 'PATCH');
