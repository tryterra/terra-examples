import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/client/lib/api";

/* ---------------------------------- Query options --------------------------------- */

export const chatListQueryOpts = queryOptions({
  queryKey: ["chat", "list"],
  queryFn: async () => {
    const res = await api.api.chat.$get();
    if (!res.ok) throw new Error("Failed to load chats");
    return res.json();
  },
});

export function chatDetailQueryOpts(id: string) {
  return queryOptions({
    queryKey: ["chat", "detail", id],
    queryFn: async () => {
      const res = await api.api.chat[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Chat not found");
      return res.json();
    },
    staleTime: Infinity,
  });
}

/* ---------------------------------- Hooks ----------------------------------------- */

export function useChatList() {
  return useQuery({ ...chatListQueryOpts, placeholderData: keepPreviousData });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.api.chat.$post();
      if (!res.ok) throw new Error("Failed to create chat");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    },
  });
}

export function useUpdateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      lastMessageAt?: string;
    }) => {
      const res = await api.api.chat[":id"].$put({
        param: { id },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update chat");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    },
  });
}

export function useGenerateTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await api.api.chat[":id"]["generate-title"].$post({
        param: { id },
        json: { message },
      });
      if (!res.ok) throw new Error("Failed to generate title");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.chat[":id"].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to delete chat");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    },
  });
}
