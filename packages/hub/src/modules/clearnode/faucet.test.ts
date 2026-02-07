import { requestFaucet, requestFaucetQueued, _resetFaucetQueue } from "./faucet";

// ── Helpers ─────────────────────────────────────────────────────────────

function mockResponse(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ── Setup ───────────────────────────────────────────────────────────────

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
  _resetFaucetQueue();
  jest.useRealTimers();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ── Retry tests ─────────────────────────────────────────────────────────

describe("requestFaucet — retry logic", () => {
  it("succeeds on first attempt — no retry, no delay", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200));

    await requestFaucet("0xAlice");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 then succeeds on 2nd attempt", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(mockResponse(200));

    await requestFaucet("0xAlice");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 twice then succeeds on 3rd attempt", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(500, "Internal Server Error"))
      .mockResolvedValueOnce(mockResponse(500, "Internal Server Error"))
      .mockResolvedValueOnce(mockResponse(200));

    await requestFaucet("0xAlice");

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("retries on network TypeError then succeeds", async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(mockResponse(200));

    await requestFaucet("0xAlice");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 400 — throws immediately", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse(400, "Bad Request"),
    );

    await expect(requestFaucet("0xAlice")).rejects.toThrow("400");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries and throws the last error", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(503, "err1"))
      .mockResolvedValueOnce(mockResponse(503, "err2"))
      .mockResolvedValueOnce(mockResponse(503, "err3"))
      .mockResolvedValueOnce(mockResponse(503, "err4"));

    await expect(requestFaucet("0xAlice")).rejects.toThrow("503");
    expect(global.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it("applies exponential backoff delays between retries", async () => {
    const delays: number[] = [];
    const origSetTimeout = globalThis.setTimeout;
    const spy = jest.spyOn(globalThis, "setTimeout").mockImplementation(
      ((fn: (...args: any[]) => void, ms?: number) => {
        if (ms && ms >= 400) delays.push(ms); // Only track backoff delays (>= 400ms)
        return origSetTimeout(fn, 0); // Execute immediately in tests
      }) as typeof setTimeout,
    );

    // All attempts fail with 503
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(503, "err"));

    await expect(requestFaucet("0xAlice")).rejects.toThrow("503");
    expect(global.fetch).toHaveBeenCalledTimes(4);

    // Should have 3 delays (between attempts 0→1, 1→2, 2→3)
    expect(delays).toHaveLength(3);
    // Each delay should be >= the base for that attempt
    // attempt 1: base 500ms, attempt 2: base 1000ms, attempt 3: base 2000ms
    expect(delays[0]).toBeGreaterThanOrEqual(500);
    expect(delays[0]).toBeLessThanOrEqual(600);  // 500 + 20% jitter
    expect(delays[1]).toBeGreaterThanOrEqual(1000);
    expect(delays[1]).toBeLessThanOrEqual(1200);
    expect(delays[2]).toBeGreaterThanOrEqual(2000);
    expect(delays[2]).toBeLessThanOrEqual(2400);

    spy.mockRestore();
  });
});

// ── Queue tests ─────────────────────────────────────────────────────────

describe("requestFaucetQueued — serialization", () => {
  it("serializes concurrent calls (call 2 starts only after call 1 resolves)", async () => {
    const callOrder: number[] = [];

    (global.fetch as jest.Mock).mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const index = body.userAddress === "0xFirst" ? 1 : 2;
      callOrder.push(index);
      return mockResponse(200);
    });

    const p1 = requestFaucetQueued("0xFirst");
    const p2 = requestFaucetQueued("0xSecond");

    await Promise.all([p1, p2]);

    // Call 1 must complete before call 2 starts
    expect(callOrder).toEqual([1, 2]);
  });

  it("queue continues after a failure (call 1 rejects, call 2 still executes)", async () => {
    (global.fetch as jest.Mock)
      // Call 1: all 4 attempts fail
      .mockResolvedValueOnce(mockResponse(503, "fail"))
      .mockResolvedValueOnce(mockResponse(503, "fail"))
      .mockResolvedValueOnce(mockResponse(503, "fail"))
      .mockResolvedValueOnce(mockResponse(503, "fail"))
      // Call 2: succeeds
      .mockResolvedValueOnce(mockResponse(200));

    const p1 = requestFaucetQueued("0xFail");
    const p2 = requestFaucetQueued("0xSucceed");

    await expect(p1).rejects.toThrow("503");
    await p2; // should not throw
  });

  it("each caller receives their own result/rejection", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200))      // call 1 succeeds
      // call 2: all attempts fail
      .mockResolvedValueOnce(mockResponse(500, "x"))
      .mockResolvedValueOnce(mockResponse(500, "x"))
      .mockResolvedValueOnce(mockResponse(500, "x"))
      .mockResolvedValueOnce(mockResponse(500, "x"));

    const p1 = requestFaucetQueued("0xA");
    const p2 = requestFaucetQueued("0xB");

    await expect(p1).resolves.toBeUndefined();
    await expect(p2).rejects.toThrow("500");
  });
});
