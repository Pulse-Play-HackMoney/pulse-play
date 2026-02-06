import type WebSocket from 'ws';

/**
 * Send a message over WebSocket and wait for a response matching the expected method.
 *
 * The Clearnode can send unsolicited messages at any time. This helper correlates
 * a request to its response by matching the expected RPC method name.
 */
export function sendAndWait(
  ws: WebSocket,
  message: string,
  expectedMethod: string,
  timeoutMs = 10_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeEventListener('message', handler);
      reject(new Error(`Timed out waiting for '${expectedMethod}' response`));
    }, timeoutMs);

    function handler(event: WebSocket.MessageEvent) {
      const raw = String(event.data);

      try {
        const parsed = JSON.parse(raw);
        const msg = parsed.res || parsed.req;
        if (!msg) return;

        const method = msg[1];

        if (method === 'error') {
          clearTimeout(timeout);
          ws.removeEventListener('message', handler);
          reject(new Error(`RPC error: ${JSON.stringify(msg[2])}`));
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
