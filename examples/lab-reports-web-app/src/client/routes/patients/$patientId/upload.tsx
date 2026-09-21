import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotchIcon, FileArrowUpIcon } from "@phosphor-icons/react";
import { Button } from "../../../components/shared/atoms/Button";
import {
  Timeline,
  type TimelineEvent,
} from "../../../components/shared/Timeline";
import { toastQueue } from "../../../components/shared/atoms/Toast";
import { unwrap } from "../../../lib/api";
import {
  uploadStatusQuery,
  type UploadStatusOk,
} from "../../../lib/queries";

export const Route = createFileRoute("/patients/$patientId/upload")({
  component: UploadPage,
});

const ACCEPTED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const MAX_BYTES = 20 * 1024 * 1024;

function UploadPage() {
  const { patientId } = Route.useParams();
  const [uploadId, setUploadId] = useState<string | null>(null);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-main-black">
          Upload a lab report
        </h2>
        <p className="text-sm text-secondary-text">
          Drop in the report exactly as the lab issued it - PDF or photo.
          Terra reads it, standardizes every biomarker, and the results land
          on this patient's record.
        </p>
      </div>
      {uploadId ? (
        <UploadProgress patientId={patientId} uploadId={uploadId} />
      ) : (
        <DropZone patientId={patientId} onUploaded={setUploadId} />
      )}
    </div>
  );
}

function DropZone({
  patientId,
  onUploaded,
}: {
  patientId: string;
  onUploaded: (uploadId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const uploadMutation = useMutation({
    // Plain fetch: the upload route takes raw multipart (no form validator),
    // so the typed RPC client has no `form` input for it.
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return unwrap<{ uploadId: string }>(
        await fetch(`/api/patients/${patientId}/upload`, {
          method: "POST",
          body: form,
        }),
      );
    },
    onSuccess: ({ uploadId }) => onUploaded(uploadId),
    onError: (err) => toastQueue.add({ title: err.message, variant: "error" }),
  });

  function pick(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.has(file.type)) {
      toastQueue.add({
        title: "Only PDF, PNG, JPEG, GIF or WebP reports are accepted.",
        variant: "error",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toastQueue.add({
        title: "That file is over the 20 MB limit.",
        variant: "error",
      });
      return;
    }
    uploadMutation.mutate(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a lab report file"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
        dragging
          ? "border-emphasis bg-emphasis-bg"
          : "border-border bg-white hover:border-emphasis"
      }`}
    >
      {uploadMutation.isPending ? (
        <>
          <CircleNotchIcon
            size={36}
            className="animate-spin text-emphasis"
          />
          <span className="text-sm text-secondary-text">Uploading…</span>
        </>
      ) : (
        <>
          <FileArrowUpIcon size={36} className="text-emphasis" />
          <span className="text-base font-medium text-main-black">
            Drop a lab report here, or click to browse
          </span>
          <span className="text-xs text-subtle-text">
            PDF, PNG, JPEG, GIF or WebP, up to 20 MB
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? undefined)}
      />
    </div>
  );
}

/** Canonical processing order for rendering the pipeline rail. */
const STAGES = [
  { status: "processing", label: "Reading the report" },
  { status: "processed", label: "Report read" },
  { status: "standardizing", label: "Standardizing biomarkers" },
  { status: "standardized", label: "Results ready" },
] as const;
const PAST_STANDARDIZED = new Set(["sending", "sent", "partially_sent"]);

function sessionEvents(
  session: UploadStatusOk["sessions"][number],
): TimelineEvent[] {
  const history = new Map(
    session.statusHistory.map((h) => [h.status, h.timestamp]),
  );
  const reachedIdx = PAST_STANDARDIZED.has(session.status)
    ? STAGES.length - 1
    : STAGES.findIndex((s) => s.status === session.status);
  const events: TimelineEvent[] = STAGES.map((stage, i) => ({
    label: stage.label,
    timestamp: history.get(stage.status),
    state: i <= reachedIdx ? "done" : "pending",
  }));
  if (session.status === "failed") {
    return [
      ...events.filter((e) => e.state === "done"),
      { label: "Processing failed", state: "warning" },
    ];
  }
  return events;
}

function UploadProgress({
  patientId,
  uploadId,
}: {
  patientId: string;
  uploadId: string;
}) {
  const queryClient = useQueryClient();
  const statusQ = useQuery(uploadStatusQuery(uploadId));
  const data = statusQ.data;
  const sessions = data?.sessions ?? [];

  if (data?.done) {
    // Fresh sessions exist now — make sure the overview list refetches.
    void queryClient.invalidateQueries({ queryKey: ["lab-reports", patientId] });
  }

  return (
    <div className="flex flex-col gap-6">
      {sessions.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-5">
          <CircleNotchIcon size={22} className="animate-spin text-emphasis" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-main-black">
              {data?.fileName ?? "Report"} received - Terra is picking it up
            </span>
            <span className="text-xs text-subtle-text">
              This usually takes 30 seconds to a couple of minutes.
            </span>
          </div>
        </div>
      ) : (
        sessions.map((s) => (
          <div
            key={s.sessionId}
            className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-main-black">
                {data?.fileName ?? "Report"}
                {sessions.length > 1 && (
                  <span className="text-subtle-text">
                    {" "}
                    (report {sessions.indexOf(s) + 1} of {sessions.length})
                  </span>
                )}
              </span>
              {s.resultsCount != null && (
                <span className="text-xs text-subtle-text">
                  {s.resultsCount} results
                </span>
              )}
            </div>
            <Timeline events={sessionEvents(s)} />
            {s.status !== "failed" &&
              (PAST_STANDARDIZED.has(s.status) ||
                s.status === "standardized") && (
                <Link
                  to="/patients/$patientId/reports/$sessionId"
                  params={{ patientId, sessionId: s.sessionId }}
                  className="self-start"
                >
                  <Button variant="primary">View results</Button>
                </Link>
              )}
            {s.status === "failed" && (
              <p className="text-sm text-warning">
                Terra couldn't process this report. Try a clearer scan or a
                different file.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
