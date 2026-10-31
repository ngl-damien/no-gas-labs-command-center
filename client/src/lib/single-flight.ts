/**
 * Prevent periodic UI probes from overlapping when an upstream request is
 * slower than the polling interval. A skipped tick is safer than allowing an
 * older response to race a newer health observation.
 */
export function createSingleFlightTask<T>(
  task: () => Promise<T>,
): () => Promise<T> | null {
  let inFlight = false;

  return () => {
    if (inFlight) return null;
    inFlight = true;

    let request: Promise<T>;
    try {
      // Invoke now so the task begins before this call returns; the promise
      // still captures synchronous throws and always releases the guard.
      request = Promise.resolve(task());
    } catch (error) {
      request = Promise.reject(error);
    }

    return request.finally(() => {
      inFlight = false;
    });
  };
}
