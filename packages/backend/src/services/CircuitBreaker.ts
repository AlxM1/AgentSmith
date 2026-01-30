// @ts-nocheck
/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by failing fast when services are unavailable
 */

import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failing fast, not making calls
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;      // Number of failures before opening
  successThreshold?: number;      // Number of successes in half-open to close
  timeout?: number;               // Time in OPEN state before trying again (ms)
  resetTimeout?: number;          // Time to wait before resetting failure count (ms)
  monitorInterval?: number;       // Health check interval (ms)
  volumeThreshold?: number;       // Minimum requests before calculating failure rate
  errorFilter?: (error: Error) => boolean;  // Filter which errors count as failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  failureRate: number;
  lastStateChange: Date;
  isHealthy: boolean;
}

interface CircuitBreakerEntry {
  options: Required<CircuitBreakerOptions>;
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  lastStateChange: Date;
  nextAttempt?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

class CircuitBreakerService extends EventEmitter {
  private circuits: Map<string, CircuitBreakerEntry> = new Map();
  private defaultOptions: Omit<Required<CircuitBreakerOptions>, 'name'> = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,          // 30 seconds
    resetTimeout: 60000,     // 1 minute
    monitorInterval: 10000,  // 10 seconds
    volumeThreshold: 10,
    errorFilter: () => true, // All errors count
  };

  /**
   * Create or get a circuit breaker
   */
  getCircuit(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreakerEntry {
    let circuit = this.circuits.get(name);

    if (!circuit) {
      circuit = {
        options: {
          name,
          ...this.defaultOptions,
          ...options,
        },
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastStateChange: new Date(),
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      };
      this.circuits.set(name, circuit);
      this.emit('circuit:created', { name, state: CircuitState.CLOSED });
    }

    return circuit;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const circuit = this.getCircuit(name, options);

    // Check if circuit allows the request
    if (!this.canExecute(circuit)) {
      this.emit('circuit:rejected', { name, state: circuit.state });

      if (fallback) {
        return fallback();
      }

      throw new CircuitOpenError(`Circuit breaker ${name} is ${circuit.state}`);
    }

    const startTime = Date.now();
    circuit.totalRequests++;

    try {
      // If half-open, this is a test request
      const result = await fn();

      this.recordSuccess(circuit);
      this.emit('circuit:success', {
        name,
        duration: Date.now() - startTime,
        state: circuit.state,
      });

      return result;
    } catch (error: any) {
      // Check if this error should trip the circuit
      if (circuit.options.errorFilter(error)) {
        this.recordFailure(circuit, error);
        this.emit('circuit:failure', {
          name,
          error: error.message,
          duration: Date.now() - startTime,
          state: circuit.state,
        });
      }

      // Try fallback if available
      if (fallback) {
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Check if circuit allows execution
   */
  private canExecute(circuit: CircuitBreakerEntry): boolean {
    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has passed
        if (circuit.nextAttempt && new Date() >= circuit.nextAttempt) {
          this.transitionTo(circuit, CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(circuit: CircuitBreakerEntry): void {
    circuit.successes++;
    circuit.totalSuccesses++;
    circuit.consecutiveSuccesses++;
    circuit.consecutiveFailures = 0;
    circuit.lastSuccess = new Date();

    // If half-open and enough successes, close the circuit
    if (
      circuit.state === CircuitState.HALF_OPEN &&
      circuit.consecutiveSuccesses >= circuit.options.successThreshold
    ) {
      this.transitionTo(circuit, CircuitState.CLOSED);
    }
  }

  /**
   * Record a failed call
   */
  private recordFailure(circuit: CircuitBreakerEntry, error: Error): void {
    circuit.failures++;
    circuit.totalFailures++;
    circuit.consecutiveFailures++;
    circuit.consecutiveSuccesses = 0;
    circuit.lastFailure = new Date();

    // If closed and too many failures, open the circuit
    if (circuit.state === CircuitState.CLOSED) {
      if (circuit.consecutiveFailures >= circuit.options.failureThreshold) {
        this.transitionTo(circuit, CircuitState.OPEN);
      }
    }

    // If half-open and failure, reopen the circuit
    if (circuit.state === CircuitState.HALF_OPEN) {
      this.transitionTo(circuit, CircuitState.OPEN);
    }
  }

  /**
   * Transition circuit to new state
   */
  private transitionTo(circuit: CircuitBreakerEntry, newState: CircuitState): void {
    const oldState = circuit.state;
    circuit.state = newState;
    circuit.lastStateChange = new Date();

    if (newState === CircuitState.OPEN) {
      // Set when to try again
      circuit.nextAttempt = new Date(Date.now() + circuit.options.timeout);
    } else if (newState === CircuitState.CLOSED) {
      // Reset counters
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.consecutiveFailures = 0;
      circuit.consecutiveSuccesses = 0;
      circuit.nextAttempt = undefined;
    } else if (newState === CircuitState.HALF_OPEN) {
      // Reset consecutive counters for testing
      circuit.consecutiveFailures = 0;
      circuit.consecutiveSuccesses = 0;
    }

    this.emit('circuit:stateChange', {
      name: circuit.options.name,
      from: oldState,
      to: newState,
      nextAttempt: circuit.nextAttempt,
    });
  }

  /**
   * Get statistics for a circuit
   */
  getStats(name: string): CircuitBreakerStats | null {
    const circuit = this.circuits.get(name);
    if (!circuit) return null;

    const failureRate =
      circuit.totalRequests > 0
        ? circuit.totalFailures / circuit.totalRequests
        : 0;

    return {
      state: circuit.state,
      failures: circuit.failures,
      successes: circuit.successes,
      consecutiveFailures: circuit.consecutiveFailures,
      consecutiveSuccesses: circuit.consecutiveSuccesses,
      lastFailure: circuit.lastFailure,
      lastSuccess: circuit.lastSuccess,
      totalRequests: circuit.totalRequests,
      totalFailures: circuit.totalFailures,
      totalSuccesses: circuit.totalSuccesses,
      failureRate,
      lastStateChange: circuit.lastStateChange,
      isHealthy: circuit.state === CircuitState.CLOSED,
    };
  }

  /**
   * Get all circuit statistics
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();

    for (const [name] of this.circuits) {
      const stat = this.getStats(name);
      if (stat) {
        stats.set(name, stat);
      }
    }

    return stats;
  }

  /**
   * Force a circuit to a specific state (for testing/admin)
   */
  forceState(name: string, state: CircuitState): boolean {
    const circuit = this.circuits.get(name);
    if (!circuit) return false;

    this.transitionTo(circuit, state);
    this.emit('circuit:forced', { name, state });
    return true;
  }

  /**
   * Reset a circuit
   */
  reset(name: string): boolean {
    const circuit = this.circuits.get(name);
    if (!circuit) return false;

    circuit.state = CircuitState.CLOSED;
    circuit.failures = 0;
    circuit.successes = 0;
    circuit.consecutiveFailures = 0;
    circuit.consecutiveSuccesses = 0;
    circuit.lastStateChange = new Date();
    circuit.nextAttempt = undefined;

    this.emit('circuit:reset', { name });
    return true;
  }

  /**
   * Remove a circuit
   */
  remove(name: string): boolean {
    const result = this.circuits.delete(name);
    if (result) {
      this.emit('circuit:removed', { name });
    }
    return result;
  }

  /**
   * Check if all circuits are healthy
   */
  isHealthy(): boolean {
    for (const circuit of this.circuits.values()) {
      if (circuit.state === CircuitState.OPEN) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get unhealthy circuits
   */
  getUnhealthyCircuits(): string[] {
    const unhealthy: string[] = [];

    for (const [name, circuit] of this.circuits) {
      if (circuit.state !== CircuitState.CLOSED) {
        unhealthy.push(name);
      }
    }

    return unhealthy;
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Decorator for circuit breaker
 */
export function withCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(
        name,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Higher-order function for circuit breaker
 */
export function wrapWithCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string,
  options?: Partial<CircuitBreakerOptions>,
  fallback?: () => ReturnType<T>
): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return circuitBreaker.execute(
      name,
      () => fn(...args),
      options,
      fallback
    );
  }) as T;
}

// Export singleton instance
export const circuitBreaker = new CircuitBreakerService();
export default CircuitBreakerService;
