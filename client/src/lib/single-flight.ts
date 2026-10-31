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
    return Promise.resolve()
      .then(task)
      .finally(() => {
        inFlight = false;
      });
  };
}
