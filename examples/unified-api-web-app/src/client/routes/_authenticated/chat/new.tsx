import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChatInput } from "@/client/components/pages/chat/ChatInput";
import { useCreateChat } from "@/client/hooks/useChatQueries";
import { appStore } from "@/client/lib/store";

export const Route = createFileRoute("/_authenticated/chat/new")({
  component: NewChatPage,
});

function NewChatPage() {
  const navigate = useNavigate();
  const createChat = useCreateChat();

  async function handleSubmit(text: string, files?: FileList) {
    if (!text.trim() && !files?.length) return;
    const { id } = await createChat.mutateAsync();
    appStore.setState((s) => ({ ...s, pendingChatMessage: { text, files } }));
    navigate({ to: "/chat/$chatId", params: { chatId: id } });
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center gap-12 px-4 py-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-semibold text-main-black">Dig deeper</h1>
        <p className="text-center text-lg font-medium text-secondary-text">
          Analyse your sleep, activity, biomarkers, and more with AI
        </p>
      </div>
      <div className="w-full">
        <ChatInput onSubmit={handleSubmit} disabled={createChat.isPending} />
      </div>
    </div>
  );
}
