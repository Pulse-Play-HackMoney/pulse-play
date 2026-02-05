/**
 * Browser-compatible WebSocket RPC utilities for Clearnode communication.
 * Port of yellow-quickstart/src/web/hooks/useYellow.ts sendAndWaitBrowser.
 */

/** Parse a Clearnode WebSocket message to extract method and params. */
function parseWsMessage(raw: string): { method: string; params: Record<string, unknown> } {
  const parsed = JSON.parse(raw);
  const msg = parsed.res || parsed.req;
  return { method: msg?.[1] ?? '', params: msg?.[2] ?? {} };
}

/**
 * Send a message over a browser WebSocket and wait for a response
 * matching the expected RPC method name.
 *
 * Filters out unsolicited messages and rejects on RPC errors or timeout.
 */
export function sendAndWaitBrowser(
  ws: WebSocket,
  message: string,
  expectedMethod: string,
  timeoutMs = 15_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeEventListener('message', handler);
      reject(new Error(`Timed out waiting for '${expectedMethod}'`));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      const raw = String(event.data);
      try {
        const { method } = parseWsMessage(raw);

        if (method === 'error') {
          clearTimeout(timeout);
          ws.removeEventListener('message', handler);
          const parsed = JSON.parse(raw);
          reject(new Error(`RPC error: ${JSON.stringify(parsed.res?.[2])}`));
          return;
        }

        if (method !== expectedMethod) return;
      } catch {
        return;
      }

      clearTimeout(timeout);
      ws.removeEventListener('message', handler);
      resolve(raw);
    }

    ws.addEventListener('message', handler);
    ws.send(message);
  });
}

/**
 * Open a browser WebSocket connection and wait for it to be ready.
 * Rejects if the connection fails.
 */
export function openClearnodeWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
  });
}
