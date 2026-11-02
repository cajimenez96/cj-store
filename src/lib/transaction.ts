import mongoose, { type ClientSession } from 'mongoose';

/** True when connected to a replica set (transactions available). */
export function isReplicaSet(): boolean {
  const client = mongoose.connection?.getClient() as unknown as {
    topology?: { description?: { type?: unknown } };
  };
  const topologyType = client?.topology?.description?.type;
  return typeof topologyType === 'string' && topologyType.includes('ReplicaSet');
}

/**
 * Runs `work` in one transaction on a replica set (`withTransaction`: retried on
 * transient conflicts, so `work` must do its reads inside and be safe to re-run),
 * or once with `session = null` on standalone, where `work` itself must undo
 * partial writes on failure. Errors thrown by `work` propagate unchanged.
 */
export async function runInTransaction<T>(work: (session: ClientSession | null) => Promise<T>): Promise<T> {
  const session = isReplicaSet() ? await mongoose.startSession().catch(() => null) : null;
  if (!session) return work(null);
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession().catch(() => {});
  }
}
