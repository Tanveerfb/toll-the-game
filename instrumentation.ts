/**
 * Server-side error reporting.
 *
 * Thin, because this app is almost entirely static and client-rendered — the
 * only server surfaces are the MDX news routes and two dev API routes. It is
 * here so a server exception is not the one class of failure with no record.
 *
 * Does nothing without `NEXT_PUBLIC_SENTRY_DSN`. See `lib/sentry.ts`.
 */
export async function register(): Promise<void> {
  const { sentryEnabled, sentryOptions } = await import("@/lib/sentry");
  if (!sentryEnabled) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(sentryOptions);
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(sentryOptions);
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
