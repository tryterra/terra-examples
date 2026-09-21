import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { queryClient } from "@/client/lib/query-client";
import {
  chatDetailQueryOpts,
  useGenerateTitle,
  useUpdateChat,
} from "@/client/hooks/useChatQueries";
import { appStore } from "@/client/lib/store";
import { ChatInput } from "@/client/components/pages/chat/ChatInput";
import { ChatMessageList } from "@/client/components/pages/chat/ChatMessageList";
import { ChatMessagesSkeleton } from "@/client/components/pages/chat/ChatPageSkeleton";

export const Route = createFileRoute("/_authenticated/chat/$chatId")({
  component: ChatPage,
  loader: async ({ params }) => {
    try {
      await queryClient.ensureQueryData(chatDetailQueryOpts(params.chatId));
    } catch {
      throw redirect({ to: "/chat" });
    }
  },
});

function ChatPage() {
  const { chatId } = Route.useParams();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-4">
      <Suspense fallback={<ChatMessagesSkeleton />}>
        <ChatContent chatId={chatId} />
      </Suspense>
    </div>
  );
}

function ChatContent({ chatId }: { chatId: string }) {
  const updateChat = useUpdateChat();
  const generateTitle = useGenerateTitle();
  const initialSentRef = useRef(false);

  const [optimisticMessage] = useState(() => appStore.state.pendingChatMessage);

  const agent = useAgent({
    agent: "chat-agent",
    name: chatId,
  });

  const chat = useAgentChat({ agent });

  useEffect(() => {
    if (!optimisticMessage || initialSentRef.current || !agent) return;
    initialSentRef.current = true;
    appStore.setState((s) => ({ ...s, pendingChatMessage: null }));
    agent.ready.then(() => {
      chat.sendMessage({
        text: optimisticMessage.text,
        ...(optimisticMessage.files && { files: optimisticMessage.files }),
      });
      updateChat.mutate({
        id: chatId,
        lastMessageAt: new Date().toISOString(),
      });
      generateTitle.mutate({ id: chatId, message: optimisticMessage.text });
    });
  }, [optimisticMessage, agent, chat, updateChat, generateTitle, chatId]);

  const chatRef = useRef(chat);
  chatRef.current = chat;
  const handleRegenerate = useCallback(async () => {
    await chatRef.current.stop();
    chatRef.current.regenerate();
  }, []);

  function handleSubmit(text: string, files?: FileList) {
    chat.sendMessage({ text, ...(files && { files }) });
    updateChat.mutate({
      id: chatId,
      lastMessageAt: new Date().toISOString(),
    });
  }

  const awaitingAgent = !!optimisticMessage && chat.messages.length === 0;
  const displayMessages: UIMessage[] = awaitingAgent
    ? [
        {
          id: "optimistic",
          role: "user",
          parts: [
            ...Array.from(optimisticMessage.files ?? []).map(
              (file) =>
                ({
                  type: "file",
                  mediaType: file.type,
                  filename: file.name,
                  url: "",
                }) as const,
            ),
            { type: "text", text: optimisticMessage.text },
          ],
        },
      ]
    : chat.messages;

  let lastAssistantIndex = -1;
  for (let i = displayMessages.length - 1; i >= 0; i--) {
    if (displayMessages[i].role === "assistant") {
      lastAssistantIndex = i;
      break;
    }
  }

  return (
    <>
      <ChatMessageList
        messages={displayMessages}
        isStreaming={chat.isStreaming || awaitingAgent}
        lastAssistantIndex={lastAssistantIndex}
        onRegenerate={handleRegenerate}
      />
      <div className="sticky bottom-0 shrink-0">
        <div className="pointer-events-none h-6 bg-linear-to-t from-bg-grey to-transparent" />
        <div className="bg-bg-grey pb-8">
          <ChatInput
            onSubmit={handleSubmit}
            onStop={() => chat.stop()}
            isStreaming={chat.isStreaming}
            disabled={false}
          />
        </div>
      </div>
    </>
  );
}
