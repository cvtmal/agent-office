// Loads the snapshot from the server into the store. The renderer never fetches.
import { validateSnapshot } from '../../shared/validate.js';
import type { Snapshot } from '../../shared/types.js';
import type { Store } from './store.js';

export const SNAPSHOT_URL = '/api/snapshot';

export async function loadSnapshot(store: Store, fetchFn: typeof fetch = fetch): Promise<void> {
  let body: unknown;
  try {
    const res = await fetchFn(SNAPSHOT_URL);
    if (!res.ok) {
      store.setConnection('error', `GET ${SNAPSHOT_URL} failed: ${String(res.status)}`);
      return;
    }
    body = await res.json();
  } catch (error) {
    store.setConnection('error', `GET ${SNAPSHOT_URL} failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const errors = validateSnapshot(body);
  if (errors.length > 0) {
    store.setConnection('error', `invalid snapshot: ${errors.join('; ')}`);
    return;
  }
  store.applySnapshot(body as Snapshot);
}
