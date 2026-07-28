import { useState } from "react";
import { ConnectingState, EmptyState, ErrorState } from "./components/EmptyState";
import { StatusPill } from "./components/StatusPill";
import { UserSection } from "./components/UserSection";
import { useStream } from "./hooks/useStream";
import { consumer } from "./lib/stream";

export default function App() {
  const { status, statusDetail, users } = useStream();
  const [query, setQuery] = useState("");

  // Insertion order = arrival order, which keeps the friendly "User N"
  // labels stable as more producers appear. Names are assigned BEFORE
  // filtering so "User 2" stays "User 2" while filtered.
  const namedUsers = Object.keys(users).map((uid, i) => ({ uid, name: `User ${i + 1}` }));
  const hasData = namedUsers.length > 0;
  const q = query.trim().toLowerCase();
  const visibleUsers = q
    ? namedUsers.filter(
        (u) => u.name.toLowerCase().includes(q) || u.uid.toLowerCase().includes(q),
      )
    : namedUsers;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-10 border-b border-outline-grey bg-white">
        <div className="flex h-16 items-center justify-between px-5">
          <h1 className="text-xl font-bold">Terra Streaming</h1>
          <StatusPill status={status} />
        </div>
      </header>

      <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 pt-24 pb-12">
        {status === "error" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-failure-background p-4">
            <svg viewBox="0 0 20 20" fill="none" className="mt-px h-5 w-5 shrink-0 text-failure" aria-hidden="true">
              <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="10" cy="13.5" r="0.9" fill="currentColor" />
            </svg>
            <div className="min-w-0 grow">
              <p className="text-sm font-semibold text-failure">Stream disconnected</p>
              <p className="text-sm text-dark-neutral">{statusDetail ?? "Connection failed."}</p>
            </div>
          </div>
        )}

        {status === "reconnecting" && statusDetail && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-warning-background p-4">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-warning/25 border-t-warning motion-reduce:animate-none" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warning">Reconnecting…</p>
              <p className="text-sm text-dark-neutral">{statusDetail}</p>
            </div>
          </div>
        )}

        {hasData ? (
          <>
            <div className="relative mb-6">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral"
                aria-hidden="true"
              >
                <circle cx="9" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13.2 13.2l3.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users…"
                aria-label="Search users"
                className="w-full rounded-lg border border-outline-grey bg-white py-2 pr-3 pl-9 text-sm placeholder:text-neutral focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
            {visibleUsers.length > 0 ? (
              <div className="space-y-10">
                {visibleUsers.map(({ uid, name }) => (
                  <UserSection key={uid} uid={uid} name={name} streams={users[uid]} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral">
                No users match &ldquo;{query.trim()}&rdquo;.
              </p>
            )}
          </>
        ) : (
          // With no data on screen, every status gets a centered island (same
          // size, so state swaps don't jump): waiting, disconnected with a
          // Retry action, or a spinner while (re)connecting. `grow` fills the
          // space below the fixed header exactly, so the island is truly
          // centered in the viewport.
          <div className="flex grow items-center justify-center">
            {status === "ready" ? (
              <EmptyState />
            ) : status === "error" ? (
              <ErrorState detail={statusDetail} onRetry={() => consumer.start()} />
            ) : (
              <ConnectingState />
            )}
          </div>
        )}
      </main>
    </>
  );
}
