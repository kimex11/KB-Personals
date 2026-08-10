import { enqueueMutation } from './queue';
import { isNetworkError } from './network-error';
import type { QueueEntry } from './db';

export async function attemptOrQueue(
  entity: QueueEntry['entity'],
  operation: string,
  args: unknown[],
  liveCall: () => Promise<unknown>,
  onNetworkFailure: () => void
): Promise<void> {
  try {
    await liveCall();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await enqueueMutation({ entity, operation, args });
    onNetworkFailure();
  }
}
