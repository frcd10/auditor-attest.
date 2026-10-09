/**
 * Cheap validation of a user-supplied Anthropic API key before anything is queued:
 * one GET /v1/models call, no tokens spent. A bad key fails here instead of burning a
 * 20-minute Actions run.
 */
export const API_KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

export type KeyCheck = { ok: true; models: string[] } | { ok: false; reason: string };

export async function checkApiKey(key: string, timeoutMs = 10_000): Promise<KeyCheck> {
  if (!API_KEY_RE.test(key)) return { ok: false, reason: "that does not look like an Anthropic API key (sk-ant-…)" };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: ctl.signal,
      cache: "no-store",
    });
    if (res.status === 401) return { ok: false, reason: "the API key was rejected (401). Check it was copied whole and not revoked" };
    if (res.status === 403) return { ok: false, reason: "the API key is not allowed to call the Messages API (403)" };
    if (!res.ok) return { ok: false, reason: `Anthropic API answered ${res.status} while checking the key` };
    const body = (await res.json()) as { data?: { id: string }[] };
    return { ok: true, models: (body.data ?? []).map((m) => m.id) };
  } catch (e) {
    return { ok: false, reason: `could not reach api.anthropic.com to check the key: ${(e as Error).name === "AbortError" ? "timeout" : (e as Error).message}` };
  } finally {
    clearTimeout(t);
  }
}

/** Does the key's organization see the model we are about to run? (dated ids count as a match) */
export function modelAvailable(models: string[], modelId: string): boolean {
  return models.some((m) => m === modelId || m.startsWith(`${modelId}-`));
}
