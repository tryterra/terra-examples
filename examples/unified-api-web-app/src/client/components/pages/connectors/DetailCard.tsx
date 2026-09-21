import type { ReactNode } from "react";
import { Button } from "@/client/components/shared/atoms/Button";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";

export function DetailCard({
  icon,
  title,
  children,
  isLoading,
  skeletonRows = 3,
  skeletonRow,
  showMore,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  isLoading: boolean;
  skeletonRows?: number;
  skeletonRow?: ReactNode;
  showMore?: { visible: boolean; isPending?: boolean; onPress: () => void };
}) {
  return (
    <div className="flex flex-col gap-4 self-start rounded-lg border border-border bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emphasis-bg">
          {icon}
        </div>
        <span className="text-base font-medium text-emphasis">{title}</span>
      </div>
      <div className="flex flex-col">
        {isLoading
          ? Array.from({ length: skeletonRows }).map((_, i) => (
              <div
                key={i}
                className={`py-3 ${i < skeletonRows - 1 ? "border-b border-border" : ""}`}
              >
                {skeletonRow ?? <Skeleton className="h-4 w-24" />}
              </div>
            ))
          : children}
      </div>
      {showMore?.visible && (
        <Button
          variant="secondary"
          size="md"
          isPending={showMore.isPending}
          onPress={showMore.onPress}
        >
          Show more
        </Button>
      )}
    </div>
  );
}
