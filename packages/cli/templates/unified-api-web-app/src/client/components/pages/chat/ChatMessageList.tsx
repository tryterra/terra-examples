import { memo, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { ChatMessage } from "./ChatMessage";
import { StreamingIndicator } from "./StreamingIndicator";

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  isStreaming,
  lastAssistantIndex,
  onRegenerate,
}: {
  messages: UIMessage[];
  isStreaming: boolean;
  lastAssistantIndex: number;
  onRegenerate: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  return (
    <div className="flex flex-1 flex-col py-4">
      {messages.map((message, index) => {
        const isLast =
          index === messages.length - 1 &&
          !(isStreaming && message.role === "user");
        return (
          <ChatMessage
            key={message.id}
            message={message}
            isLastAssistant={index === lastAssistantIndex}
            isStreaming={isStreaming}
            hideActions={isStreaming && index === lastAssistantIndex}
            onRegenerate={onRegenerate}
            className={isLast ? "" : "mb-16"}
          />
        );
      })}
      {isStreaming && messages[messages.length - 1]?.role === "user" && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1 rounded-2xl bg-white px-4 py-3">
            <span className="inline-block size-2 animate-pulse rounded-full bg-emphasis" />
            <span className="inline-block size-2 animate-pulse rounded-full bg-emphasis [animation-delay:150ms]" />
            <span className="inline-block size-2 animate-pulse rounded-full bg-emphasis [animation-delay:300ms]" />
          </div>
        </div>
      )}
      {isStreaming && messages[messages.length - 1]?.role === "assistant" && (
        <StreamingIndicator />
      )}
      <div ref={bottomRef} />
    </div>
  );
});
