import type { ReactNode } from "react";

// The two pre-data states share one island card so the page doesn't jump
// when the connection comes up: same size, same position, swapped content.
function Island({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[220px] w-full max-w-[560px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-grey bg-white p-8 text-center">
      {children}
    </div>
  );
}

// Shown while minting a token / waiting for READY.
export function ConnectingState() {
  return (
    <Island>
      <span className="mx-auto mb-1 block h-5 w-5 animate-spin rounded-full border-2 border-outline-grey border-t-primary motion-reduce:animate-none" />
      <p className="text-lg font-semibold">Connecting to Terra…</p>
      <p className="text-sm text-neutral">Opening the live stream. This takes a second.</p>
    </Island>
  );
}

// Shown when the stream is down and there's no data to look at: the island
// is the main call to action (the banner above stays for context). Clicking
// Retry flips the island to ConnectingState while the stream reopens.
export function ErrorState({ detail, onRetry }: { detail: string | null; onRetry: () => void }) {
  return (
    <Island>
      <svg viewBox="0 0 20 20" fill="none" className="mx-auto mb-1 h-6 w-6 text-failure" aria-hidden="true">
        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="13.5" r="0.9" fill="currentColor" />
      </svg>
      <p className="text-lg font-semibold">Stream disconnected</p>
      <p className="max-w-md text-sm text-neutral">{detail ?? "Connection failed."}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Retry
      </button>
    </Island>
  );
}

// Shown when the consumer is connected but no producers are streaming yet.
export function EmptyState() {
  return (
    <Island>
      <p className="text-lg font-semibold">Connected and listening</p>
      <p className="max-w-md text-sm text-neutral">
        No one is streaming yet. Create a test user on the Terra dashboard and live data will
        appear here instantly.
      </p>
      <a
        href="https://dashboard.tryterra.co/dashboard/streaming?create=1"
        target="_blank"
        rel="noreferrer"
        className="my-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Create a test user
      </a>
      <p className="text-xs text-neutral">Test users stream synthetic data, no hardware needed.</p>
    </Island>
  );
}
