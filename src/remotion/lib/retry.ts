export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULTS: RetryOptions = {
  maxAttempts: 4,
  baseDelayMs: 1000,
  maxDelayMs: 16_000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {}
): Promise<T> {
  const cfg = { ...DEFAULTS, ...opts };
  let lastErr: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = cfg.shouldRetry ? cfg.shouldRetry(err, attempt) : true;
      if (!retryable || attempt === cfg.maxAttempts) break;

      const delay = Math.min(
        cfg.maxDelayMs,
        cfg.baseDelayMs * 2 ** (attempt - 1) + Math.random() * 250
      );
      cfg.onRetry?.(err, attempt, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}
