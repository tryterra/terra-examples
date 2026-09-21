import { useState } from "react";
import {
  CaretRightIcon,
  DotsThreeIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/client/components/shared/atoms/Button";
import { EmptyState } from "@/client/components/shared/atoms/EmptyState";
import {
  GridList,
  GridListItem,
} from "@/client/components/shared/atoms/GridList";
import {
  Menu,
  MenuItem,
  MenuTrigger,
} from "@/client/components/shared/atoms/Menu";
import { SearchField } from "@/client/components/shared/atoms/SearchField";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import { useChatList, useDeleteChat } from "@/client/hooks/useChatQueries";
import { useFuzzySearch } from "@/client/hooks/useFuzzySearch";
import { formatDateHeading, formatTime } from "@/client/lib/format";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatIndexPage,
});

function ChatIndexPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useChatList();
  const deleteChat = useDeleteChat();
  const [search, setSearch] = useState("");

  const filteredChats = useFuzzySearch(data?.chats ?? [], search, ["title"]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold leading-none text-main-black">
            Chats
          </h1>
          <p className="text-base text-secondary-text">
            Your previous conversations.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          className="shrink-0"
          onPress={() => navigate({ to: "/chat/new" })}
        >
          <PlusIcon size={16} weight="bold" />
          <span>New chat</span>
        </Button>
      </div>

      <SearchField
        aria-label="Search chats"
        placeholder="Search your chats..."
        value={search}
        onChange={setSearch}
      />

      {isLoading ? (
        <div className="flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-border py-4">
              <Skeleton className="mb-1 h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : filteredChats.length > 0 ? (
        <GridList
          aria-label="Chat list"
          onAction={(key) =>
            navigate({
              to: "/chat/$chatId",
              params: { chatId: key as string },
            })
          }
        >
          {filteredChats.map((chat) => (
            <GridListItem
              key={chat.id}
              id={chat.id}
              textValue={chat.title ?? "New conversation"}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-medium text-main-black">
                  {chat.title || "New conversation"}
                </span>
                <span className="text-sm text-secondary-text">
                  {formatDateHeading(chat.lastMessageAt ?? chat.createdAt)},{" "}
                  {formatTime(chat.lastMessageAt ?? chat.createdAt)}
                </span>
              </div>
              <MenuTrigger>
                <Button aria-label="Chat options" variant="quiet" size="sm">
                  <DotsThreeIcon
                    size={24}
                    weight="bold"
                    className="text-subtle-text"
                  />
                </Button>
                <Menu>
                  <MenuItem
                    onAction={() => deleteChat.mutate(chat.id)}
                    textValue="Delete"
                  >
                    <TrashIcon size={20} className="text-failure" />
                    <span className="text-failure">Delete</span>
                  </MenuItem>
                </Menu>
              </MenuTrigger>
              <CaretRightIcon size={24} className="shrink-0 text-subtle-text" />
            </GridListItem>
          ))}
        </GridList>
      ) : (
        <EmptyState>
          {search.trim() ? "No matching chats" : "No conversations yet"}
        </EmptyState>
      )}
    </div>
  );
}
