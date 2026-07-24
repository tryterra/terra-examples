/**
 * Status timeline (dot-rail idiom), shared by storefront kit detail and ops
 * order detail. Renders forward-chronologically: oldest first, pending last.
 */
import { formatDateTime } from "../../lib/format";

export interface TimelineEvent {
  label: string;
  timestamp?: string;
  state: "done" | "warning" | "pending";
  detail?: string;
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => (
        <li key={`${e.label}-${i}`} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={
                e.state === "done"
                  ? "size-6 shrink-0 rounded-full bg-emphasis"
                  : e.state === "warning"
                    ? "size-6 shrink-0 rounded-full bg-warning"
                    : "size-6 shrink-0 rounded-full border-2 border-border bg-white"
              }
            />
            {i < events.length - 1 && (
              <span className="w-0.5 flex-1 bg-border" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 pb-5">
            <span
              className={`text-base font-medium ${e.state === "pending" ? "text-subtle-text" : "text-main-black"}`}
            >
              {e.label}
            </span>
            <span className="text-sm text-subtle-text">
              {e.timestamp ? formatDateTime(e.timestamp) : "—"}
              {e.detail ? ` · ${e.detail}` : ""}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
