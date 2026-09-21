import { Skeleton } from "@/client/components/shared/atoms/Skeleton";

export function ScoreCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[10px] border border-border"
        >
          <Skeleton className="h-32 rounded-none bg-emphasis-bg" />
          <div className="flex flex-col gap-3 border-t border-border bg-white p-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BiomarkerCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ActivitiesSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 py-4 ${i < 2 ? "border-b border-border" : ""}`}
        >
          <Skeleton className="size-12" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
