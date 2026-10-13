import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudSyncScheduler } from "@/lib/game/cloudSync";

/**
 * The three rules of the cloud write (2026-10-13, issues #30 and #31).
 *
 * Each one was a real loss path in `AuthProvider`: a write before the first
 * read succeeded overwrote the cloud with starter defaults; the sign-out
 * cleanup cleared the pending timer and dropped the last 1.5 s of progress.
 */
describe("createCloudSyncScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing until the cloud is ready", async () => {
    const save = vi.fn(async () => {});
    const sync = createCloudSyncScheduler({ save, delayMs: 100 });
    sync.notify();
    await vi.advanceTimersByTimeAsync(1000);
    await sync.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("collapses a burst into one write a beat after the last change", async () => {
    const save = vi.fn(async () => {});
    const sync = createCloudSyncScheduler({ save, delayMs: 100 });
    sync.setReady(true);
    sync.notify();
    await vi.advanceTimersByTimeAsync(60);
    sync.notify();
    await vi.advanceTimersByTimeAsync(60);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flush writes a pending change now and cancels the timer", async () => {
    const save = vi.fn(async () => {});
    const sync = createCloudSyncScheduler({ save, delayMs: 100 });
    sync.setReady(true);
    sync.notify();
    await sync.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flush with nothing pending writes nothing", async () => {
    const save = vi.fn(async () => {});
    const sync = createCloudSyncScheduler({ save, delayMs: 100 });
    sync.setReady(true);
    await sync.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("going not-ready drops what was pending instead of writing it later", async () => {
    // What was pending was computed against a cloud we no longer trust
    // (sign-out, or a read that failed): writing it would be finding 3 again.
    const save = vi.fn(async () => {});
    const sync = createCloudSyncScheduler({ save, delayMs: 100 });
    sync.setReady(true);
    sync.notify();
    sync.setReady(false);
    await vi.advanceTimersByTimeAsync(500);
    sync.setReady(true);
    await sync.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("a failed write stays pending so the next flush retries it", async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const sync = createCloudSyncScheduler({ save, delayMs: 100 });
    sync.setReady(true);
    sync.notify();
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    await sync.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
