// Only voice/chat/validated phrasing leave the factory mock; plant APIs stay local.
export async function tryRealCopilot(fetchAgent, url, init = {}, timeout = 30000) {
  const target = new URL(url);
  const base = new URL(import.meta.env.VITE_COPILOT_BASE_URL || 'http://localhost:8001');
  if (target.origin !== base.origin || !/^\/copilot\/(?:voice\/|chat(?:\/history)?$|evon\/phrase$|handover$)/.test(target.pathname)) return null;
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal.reason);
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  init.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = new Headers(init.headers);
    // Axios sets multipart/form-data, but fetch must supply the boundary itself.
    if (init.body instanceof FormData) headers.delete('Content-Type');
    return await fetchAgent(url, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    // HTTP errors are real Agent responses, not a reason to fabricate a mock reply.
    if (error instanceof TypeError || controller.signal.aborted) return null;
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}
