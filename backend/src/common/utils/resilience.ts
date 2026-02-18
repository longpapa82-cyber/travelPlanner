import { Logger } from '@nestjs/common';

const logger = new Logger('Resilience');

/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't resolve
 * within the specified duration.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Retries an async function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  backoffMs = 1000,
  label = 'operation',
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(2, attempt);
        logger.warn(
          `${label} attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms: ${lastError.message}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * In-memory circuit breaker. No external dependencies.
 *
 * - CLOSED: requests pass through normally
 * - OPEN: requests fail immediately (fast-fail) after failureThreshold consecutive failures
 * - HALF_OPEN: after resetTimeout, allows one probe request through
 */
export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(opts: {
    name: string;
    failureThreshold?: number;
    resetTimeoutMs?: number;
  }) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 60_000;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        logger.log(`Circuit ${this.name}: HALF_OPEN — testing with probe request`);
      } else {
        throw new Error(
          `Circuit ${this.name} is OPEN — fast-fail (resets in ${Math.ceil((this.resetTimeoutMs - (Date.now() - this.lastFailureTime)) / 1000)}s)`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      logger.log(`Circuit ${this.name}: CLOSED — service recovered`);
    }
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.warn(
        `Circuit ${this.name}: OPEN — ${this.failureCount} consecutive failures (reset in ${this.resetTimeoutMs / 1000}s)`,
      );
    }
  }

  getState(): string {
    return this.state;
  }
}
