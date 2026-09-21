/**
 * Intelligence Brief: terse AI-generated chart-note bullets for the patient,
 * with an inline conversation underneath — ask follow-ups in place. Neutral
 * card styling; hidden entirely when no AI key is configured.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  ArrowsClockwiseIcon,
  BroomIcon,
  ClipboardTextIcon,
  PaperPlaneRightIcon,
  PulseIcon,
} from "@phosphor-icons/react";
import { Button } from "../../shared/atoms/Button";
import { Skeleton } from "../../shared/atoms/Skeleton";
import { toastQueue } from "../../shared/atoms/Toast";
import { api, unwrap } from "../../../lib/api";
import {
  aiOverviewQuery,
  analysisQuery,
  patientQuery,
  type AiOverviewOk,
} from "../../../lib/queries";
import { formatRelativeTime } from "../../../lib/format";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const briefComponents = {
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="flex list-disc flex-col gap-1.5 pl-5" {...props} />
  ),
  li: (props: React.ComponentProps<"li">) => (
    <li className="text-sm leading-snug text-main-black" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="text-sm leading-snug text-main-black" {...props} />
  ),
  // The brief is plain chart-note text — neutralize any emphasis the model
  // might still emit (belt and suspenders with the prompt rule).
  strong: (props: React.ComponentProps<"strong">) => (
    <span className="font-normal" {...props} />
  ),
  em: (props: React.ComponentProps<"em">) => (
    <span className="not-italic" {...props} />
  ),
};

const chatComponents = {
  ...briefComponents,
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="flex list-disc flex-col gap-1 pl-4 text-sm" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="flex list-decimal flex-col gap-1 pl-4 text-sm" {...props} />
  ),
};

export function IntelligenceBrief({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const briefQ = useQuery(aiOverviewQuery(patientId));
  const patientQ = useQuery(patientQuery(patientId));
  const analysisQ = useQuery(analysisQuery(patientId));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  // Plain-text chart note for pasting into an EHR — doctors live in notes.
  const copyNote = () => {
    const p = patientQ.data?.patient;
    const flagged = (analysisQ.data?.domains ?? [])
      .flatMap((d) => d.contributions)
      .filter((c) => c.kind === "lab" && c.severity !== "normal")
      .map((c) => `${c.label} ${c.valueText}`);
    const lines = [
      `${p ? `${p.firstName} ${p.lastName}` : "Patient"} - data summary, ${new Date().toLocaleDateString()}`,
      "",
      (briefQ.data?.enabled && briefQ.data.overview.content) || "",
      "",
      flagged.length > 0
        ? `Out of range: ${[...new Set(flagged)].join("; ")}`
        : "",
      "Source: standardized lab reports + patient wearable (Terra). Observations only, not a diagnosis.",
    ].filter(Boolean);
    void navigator.clipboard.writeText(lines.join("\n")).then(
      () => toastQueue.add({ title: "Chart note copied", variant: "default" }),
      () => toastQueue.add({ title: "Couldn't copy", variant: "error" }),
    );
  };

  const refresh = useMutation({
    mutationFn: async () =>
      unwrap<AiOverviewOk>(
        await api.api.patients[":id"].ai.overview.$post({
          param: { id: patientId },
        }),
      ),
    onSuccess: (data) =>
      queryClient.setQueryData(aiOverviewQuery(patientId).queryKey, data),
    onError: (err) => toastQueue.add({ title: err.message, variant: "error" }),
  });

  const send = useMutation({
    mutationFn: async (history: Message[]) =>
      unwrap<{ enabled: boolean; reply?: string }>(
        await api.api.chat.$post({ json: { messages: history, patientId } }),
      ),
    onSuccess: (data) => {
      if (data.enabled && data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
      }
    },
    onError: (err) => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Something went wrong: ${err.message}` },
      ]);
    },
  });

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, send.isPending]);

  const chatActive = messages.length > 0 || send.isPending;

  function submit() {
    const text = input.trim();
    if (!text || send.isPending) return;
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setInput("");
    send.mutate(history.slice(-20));
  }

  if (briefQ.isLoading) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary-text">
          <PulseIcon size={16} weight="bold" />
          Reading the chart…
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (briefQ.isError) {
    return (
      <p className="text-sm text-warning">
        Intelligence brief unavailable: {briefQ.error.message}
      </p>
    );
  }

  const data = briefQ.data;
  if (!data || !data.enabled) return null; // no key configured — hide quietly
  // Pre-generated brief without a live key (demo mode): no chat, no refresh.
  const live = !("live" in data) || data.live !== false;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-white">
      {/* Brief */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-main-black">
            <PulseIcon size={16} weight="bold" className="text-secondary-text" />
            Intelligence Brief
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-subtle-text">
              Updated {formatRelativeTime(data.overview.createdAt)}
            </span>
            <Button
              variant="quiet"
              size="sm"
              aria-label="Copy chart note"
              onPress={copyNote}
            >
              <ClipboardTextIcon size={16} /> Copy note
            </Button>
            {live && (
              <Button
                variant="quiet"
                size="sm"
                className="aspect-square px-0"
                aria-label="Regenerate brief"
                isDisabled={refresh.isPending}
                onPress={() => refresh.mutate()}
              >
                <ArrowsClockwiseIcon
                  size={16}
                  className={refresh.isPending ? "animate-spin" : undefined}
                />
              </Button>
            )}
          </div>
        </div>
        {refresh.isPending ? (
          <p className="text-sm text-secondary-text">Regenerating…</p>
        ) : (
          <ReactMarkdown components={briefComponents}>
            {data.overview.content}
          </ReactMarkdown>
        )}
      </div>

      {/* Conversation — expands to a fixed height once a chat starts, so
          replies scroll inside the card instead of growing the page. */}
      <div
        className={`overflow-hidden transition-[height,border-color] duration-300 ease-out ${
          chatActive ? "h-80 border-t border-border" : "h-0 border-t border-transparent"
        }`}
      >
        <div ref={threadRef} className="h-full overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="ml-12 self-end rounded-xl rounded-br-sm bg-bg-grey px-3 py-2 text-sm font-medium text-main-black"
                >
                  {m.content}
                </div>
              ) : (
                <div key={i} className="mr-6 self-start text-main-black">
                  <ReactMarkdown components={chatComponents}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              ),
            )}
            {send.isPending && (
              <div className="flex items-center gap-1.5 self-start py-1">
                <span className="size-1.5 animate-bounce rounded-full bg-subtle-text [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-subtle-text [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-subtle-text [animation-delay:300ms]" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      {!live && (
        <p className="border-t border-border px-4 py-2.5 text-xs text-subtle-text">
          Follow-up chat needs an Anthropic API key in .env.
        </p>
      )}
      {live && (
      <div className="flex items-center gap-2 border-t border-border p-3">
        {chatActive && (
          <Button
            variant="quiet"
            size="sm"
            className="aspect-square px-0"
            aria-label="Clear chat"
            isDisabled={send.isPending}
            onPress={() => setMessages([])}
          >
            <BroomIcon size={16} />
          </Button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask a follow-up about this patient…"
          className="h-9 flex-1 rounded-lg border border-border px-3 text-sm text-main-black outline-none placeholder:text-subtle-text focus:border-emphasis-secondary"
        />
        <Button
          variant="secondary"
          size="sm"
          className="aspect-square px-0"
          aria-label="Send"
          isDisabled={send.isPending || input.trim() === ""}
          onPress={submit}
        >
          <PaperPlaneRightIcon size={16} weight="bold" />
        </Button>
      </div>
      )}
    </div>
  );
}
