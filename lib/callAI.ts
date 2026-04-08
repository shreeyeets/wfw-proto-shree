/**
 * Shared callAI utility — thin wrapper over /api/chat.
 * Used by all UC pages to avoid duplicating fetch logic.
 */
export async function callAI(
  system: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 15_000,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.content;
  } finally {
    clearTimeout(timeout);
  }
}
