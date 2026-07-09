import { lazy, memo, Suspense, useState } from "react";
import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import {
  getToolPartState,
  getToolOutput,
  getToolInput,
} from "@cloudflare/ai-chat/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/client/lib/chat/markdown-components";
import { getToolDisplayName } from "@/client/lib/chat/tool-name";
import { Badge } from "@/client/components/shared/atoms/Badge";
import { Button } from "@/client/components/shared/atoms/Button";
import { Tooltip } from "@/client/components/shared/atoms/Tooltip";
import { TooltipTrigger } from "react-aria-components";
import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
} from "@/client/components/shared/atoms/Disclosure";
import {
  CopyIcon,
  ArrowsClockwiseIcon,
  CheckIcon,
  XCircleIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { tokenize, SugarHigh } from "sugar-high";
import type { ChartData } from "./ChatChart";

const ChatChart = lazy(() =>
  import("./ChatChart").then((m) => ({ default: m.ChatChart })),
);

/* ------------------------------ Syntax highlighting ---------------------- */

const TOKEN_COLORS: Record<string, string> = {
  identifier: "var(--sh-identifier)",
  keyword: "var(--sh-keyword)",
  string: "var(--sh-string)",
  class: "var(--sh-class)",
  property: "var(--sh-property)",
  entity: "var(--sh-entity)",
  sign: "var(--sh-sign)",
  comment: "var(--sh-comment)",
};

/** Renders syntax-highlighted code using sugar-high's tokenize() to avoid dangerouslySetInnerHTML. */
function HighlightedCode({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const normalized = code.replace(/"(\w+)"(\s*:)/g, "$1$2");
  const tokens = tokenize(normalized);
  return (
    <pre
      className={`overflow-auto rounded-lg bg-emphasis-bg p-3 font-mono text-xs leading-relaxed ${className ?? "max-h-48"}`}
    >
      {tokens.map(([type, text], i) => {
        const typeName = SugarHigh.TokenTypes[type];
        if (typeName === "break") return <br key={i} />;
        if (typeName === "space") return text;
        const color = TOKEN_COLORS[typeName];
        return color ? (
          <span key={i} style={{ color }}>
            {text}
          </span>
        ) : (
          text
        );
      })}
    </pre>
  );
}

/* -------------------------------- Markdown -------------------------------- */

/** Memoized markdown renderer to avoid re-parsing on every streaming token. */
const MarkdownContent = memo(function MarkdownContent({
  text,
}: {
  text: string;
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
});

/* ------------------------------ Tool status ------------------------------- */

function ToolCallLoading({
  name,
  stopped,
}: {
  name: string;
  stopped?: boolean;
}) {
  const label =
    name === "analyze" ? "Running analysis" : "Fetching health data";

  if (stopped) {
    return (
      <div className="flex items-center gap-2 text-sm text-subtle-text">
        Stopped: {label.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-subtle-text">
      <SpinnerGapIcon size={20} className="animate-spin text-subtle-text" />
      {label}
    </div>
  );
}

/** Extracts the parsed payload from an MCP tool response. */
function parseMcpOutput(output: unknown): unknown {
  if (!output || typeof output !== "object") return output;
  if ("content" in output) {
    const content = (output as { content: unknown[] }).content;
    if (Array.isArray(content)) {
      const textPart = content.find(
        (c): c is { type: "text"; text: string } =>
          typeof c === "object" &&
          c !== null &&
          "type" in c &&
          (c as { type: string }).type === "text",
      );
      if (textPart) {
        try {
          return JSON.parse(textPart.text);
        } catch {
          return textPart.text;
        }
      }
    }
  }
  return output;
}

/** Summarises the tool output for the collapsed disclosure label. */
function getToolSummary(name: string): string {
  if (name === "analyze") return "Ran analysis";
  return "Fetched health data";
}

function ToolCallComplete({
  name,
  input,
  output,
}: {
  name: string;
  input: unknown;
  output: unknown;
}) {
  const parsed = parseMcpOutput(output);
  const summary = getToolSummary(name);

  return (
    <Disclosure className="min-w-0 rounded-none">
      <DisclosureHeader>{summary}</DisclosureHeader>
      <DisclosurePanel className="[&>div]:px-0 [&>div]:pt-3 [&>div]:pb-1">
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-subtle-text">
              Tool: {name}
            </p>
            <HighlightedCode code={JSON.stringify(input, null, 2)} />
          </div>
          {parsed != null && (
            <div>
              <p className="mb-2 text-xs font-semibold text-subtle-text">
                Response
              </p>
              <HighlightedCode
                code={
                  typeof parsed === "string"
                    ? parsed
                    : JSON.stringify(parsed, null, 2)
                }
                className="max-h-64"
              />
            </div>
          )}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}

function AnalysisComplete({
  input,
  output,
}: {
  input: unknown;
  output: unknown;
}) {
  const code =
    input && typeof input === "object" && "code" in input
      ? String((input as { code: string }).code)
      : null;

  const result =
    output && typeof output === "object" && "result" in output
      ? (output as { result: unknown }).result
      : output;

  const logs =
    output && typeof output === "object" && "logs" in output
      ? (output as { logs: string[] }).logs
      : [];

  return (
    <Disclosure className="min-w-0 rounded-none">
      <DisclosureHeader>Ran analysis</DisclosureHeader>
      <DisclosurePanel className="[&>div]:px-0 [&>div]:pt-3 [&>div]:pb-1">
        <div className="flex flex-col gap-3">
          {code && (
            <div>
              <p className="mb-2 text-xs font-semibold text-subtle-text">
                Code
              </p>
              <HighlightedCode code={code} />
            </div>
          )}
          {result != null && (
            <div>
              <p className="mb-2 text-xs font-semibold text-subtle-text">
                Result
              </p>
              <HighlightedCode
                code={
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2)
                }
              />
            </div>
          )}
          {logs && logs.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-subtle-text">
                Logs
              </p>
              <pre className="max-h-32 overflow-auto rounded-lg bg-emphasis-bg p-3 font-mono text-xs text-subtle-text">
                {logs.join("\n")}
              </pre>
            </div>
          )}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}

function ToolCallError({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-failure">
      <XCircleIcon size={14} weight="bold" className="shrink-0" />
      Failed: {name}
    </div>
  );
}

/* ----------------------------- Message actions ---------------------------- */

/** Copy and regenerate buttons shown below assistant messages. */
function MessageActions({
  message,
  isLastAssistant,
  onRegenerate,
}: {
  message: UIMessage;
  isLastAssistant: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipTrigger delay={0} closeDelay={0}>
        <Button
          variant="quiet"
          size="sm"
          onPress={handleCopy}
          aria-label="Copy message"
          className="text-subtle-text"
        >
          {copied ? (
            <CheckIcon size={20} weight="bold" />
          ) : (
            <CopyIcon size={20} />
          )}
        </Button>
        <Tooltip>{copied ? "Copied!" : "Copy"}</Tooltip>
      </TooltipTrigger>
      {isLastAssistant && (
        <TooltipTrigger delay={0} closeDelay={0}>
          <Button
            variant="quiet"
            size="sm"
            onPress={onRegenerate}
            aria-label="Regenerate response"
            className="text-subtle-text"
          >
            <ArrowsClockwiseIcon size={20} />
          </Button>
          <Tooltip>Regenerate</Tooltip>
        </TooltipTrigger>
      )}
    </div>
  );
}

/* ------------------------------- Chat bubble ------------------------------ */

export function ChatMessage({
  message,
  isLastAssistant,
  isStreaming,
  hideActions,
  onRegenerate,
  className,
}: {
  message: UIMessage;
  isLastAssistant: boolean;
  isStreaming?: boolean;
  hideActions?: boolean;
  onRegenerate: () => void;
  className?: string;
}) {
  const isUser = message.role === "user";
  const fileParts = message.parts.filter((p) => p.type === "file");

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} ${className ?? ""}`}
    >
      <div
        className={`flex flex-col gap-2 ${
          isUser
            ? "max-w-[85%] rounded-lg bg-emphasis-bg p-4 text-main-black"
            : "w-full text-main-black"
        }`}
      >
        {fileParts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fileParts.map((part, i) => (
              <Badge
                key={`${part.filename}-${i}`}
                variant="neutral"
                className="rounded-lg border-transparent bg-white/60 px-2.5 py-1 font-normal text-secondary-text"
              >
                {part.filename ?? "Attachment"}
              </Badge>
            ))}
          </div>
        )}

        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text.trim()) {
            return (
              <div key={i} className="text-base leading-7">
                <MarkdownContent text={part.text} />
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const state = getToolPartState(part);
            const rawToolName =
              "toolName" in part
                ? (part.toolName as string)
                : part.type.startsWith("tool-")
                  ? part.type.slice(5)
                  : "tool";
            const toolName = getToolDisplayName(part);

            if (rawToolName === "render_chart" && state === "complete") {
              const output = getToolOutput(part);
              if (output && typeof output === "object" && "data" in output) {
                return (
                  <Suspense
                    key={i}
                    fallback={
                      <div className="h-48 animate-pulse rounded-xl bg-hover-grey" />
                    }
                  >
                    <ChatChart data={output as ChartData} />
                  </Suspense>
                );
              }
            }

            if (rawToolName === "analyze" && state === "complete") {
              const input = getToolInput(part);
              const output = getToolOutput(part);
              return <AnalysisComplete key={i} input={input} output={output} />;
            }

            if (rawToolName === "generate_title") return null;

            if (state === "loading" || state === "streaming") {
              return (
                <ToolCallLoading
                  key={i}
                  name={rawToolName}
                  stopped={!isStreaming}
                />
              );
            }

            if (state === "complete") {
              const input = getToolInput(part);
              const output = getToolOutput(part);
              return (
                <ToolCallComplete
                  key={i}
                  name={toolName}
                  input={input}
                  output={output}
                />
              );
            }

            if (state === "error") {
              return <ToolCallError key={i} name={toolName} />;
            }
          }

          return null;
        })}

        {!isUser && !hideActions && (
          <MessageActions
            message={message}
            isLastAssistant={isLastAssistant}
            onRegenerate={onRegenerate}
          />
        )}
      </div>
    </div>
  );
}
