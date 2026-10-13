/**
 * When a cloud write happens, as a pure scheduler with no Firebase, React or
 * store in it, so the three rules below can be tested with fake timers.
 *
 * Extracted from `AuthProvider` on 2026-10-13 (audit findings 3 and 5,
 * issues #30 and #31):
 *
 * - **Nothing is written until the cloud is ready.** The provider used to
 *   arm its auto-sync subscriber the moment a user signed in, before the
 *   first read had succeeded. If that read failed (offline on a fresh
 *   device), the next store change wrote a full document of starter
 *   defaults over the real save. `setReady(true)` is called only after a
 *   successful read or seed; until then `notify()` is a no-op.
 * - **A burst of changes is one write**, a beat after the last one.
 * - **Pending work is flushed, not dropped.** The old cleanup cleared the
 *   timer when the user signed out, so a pull followed by sign-out or a
 *   closed tab never reached Firestore. `flush()` writes now if anything is
 *   pending; `logout` and `visibilitychange` call it.
 */
export interface CloudSyncScheduler {
  /** A synced field changed. Schedules a write if the cloud is ready. */
  notify: () => void;
  /** Write now if a change is pending; resolves when the write settles. */
  flush: () => Promise<void>;
  /** Gate every write. `false` also drops anything pending, because what
   *  was pending was written against a cloud state we no longer trust. */
  setReady: (ready: boolean) => void;
  isReady: () => boolean;
  /** Cancels a pending timer without writing. For unmount only. */
  dispose: () => void;
}

export function createCloudSyncScheduler(options: {
  save: () => Promise<void>;
  delayMs: number;
}): CloudSyncScheduler {
  let ready = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const write = async () => {
    clear();
    if (!ready || !dirty) return;
    dirty = false;
    try {
      await options.save();
    } catch {
      // The provider reports the failure; the change is marked dirty again
      // so the next flush retries rather than losing it.
      dirty = true;
    }
  };

  return {
    notify: () => {
      if (!ready) return;
      dirty = true;
      clear();
      timer = setTimeout(() => {
        void write();
      }, options.delayMs);
    },
    flush: write,
    setReady: (next) => {
      ready = next;
      if (!next) {
        dirty = false;
        clear();
      }
    },
    isReady: () => ready,
    dispose: clear,
  };
}
