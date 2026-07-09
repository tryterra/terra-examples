import { Skeleton } from "@/client/components/shared/atoms/Skeleton";

export function ChatMessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-16 py-4">
      <div className="flex justify-end">
        <Skeleton className="h-12 w-48 rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );
}
