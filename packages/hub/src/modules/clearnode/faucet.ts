const DEFAULT_FAUCET_URL =
  "https://clearnet-sandbox.yellow.com/faucet/requestTokens";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;
const JITTER_FACTOR = 0.2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Request test tokens from the Yellow Network sandbox faucet.
 * Retries on 5xx and network errors with exponential backoff + jitter.
 * No auth required — just needs a wallet address.
 */
export async function requestFaucet(
  address: string,
  faucetUrl: string = DEFAULT_FAUCET_URL,
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
      const jitter = delay * JITTER_FACTOR * Math.random();

      if (process.env.NODE_ENV !== "test") {
        console.warn(
          `[faucet] Retry ${attempt}/${MAX_RETRIES} for ${address} after ${Math.round(delay + jitter)}ms`,
        );
      }

      await sleep(delay + jitter);
    }

    try {
      const response = await fetch(faucetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address }),
      });

      if (response.ok) return;

      const text = await response.text();
      const err = new Error(`Faucet request failed (${response.status}): ${text}`);

      // Don't retry 4xx — client errors
      if (response.status >= 400 && response.status < 500) {
        throw err;
      }

      // 5xx — retryable
      lastError = err;
    } catch (err: any) {
      // Network TypeError (connection refused, DNS failure) — retryable
      if (err instanceof TypeError) {
        lastError = err;
        continue;
      }
      // Everything else (including our 4xx throws above) — not retryable
      throw err;
    }
  }

  throw lastError ?? new Error("Faucet request failed after retries");
}

// ── Global serialization queue ──────────────────────────────────────────

let queueTail: Promise<any> = Promise.resolve();

/**
 * Queued version of requestFaucet that serializes all calls so only one
 * HTTP request to the external faucet is in-flight at a time.
 */
export function requestFaucetQueued(
  address: string,
  faucetUrl?: string,
): Promise<void> {
  const next = queueTail.catch(() => {}).then(() => requestFaucet(address, faucetUrl));
  queueTail = next;
  return next;
}

/** Reset the queue (for test cleanup). */
export function _resetFaucetQueue(): void {
  queueTail = Promise.resolve();
}
