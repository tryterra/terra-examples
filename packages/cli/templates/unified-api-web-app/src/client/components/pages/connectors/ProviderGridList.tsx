import type { ReactNode } from "react";
import type { Key } from "react-aria-components";
import {
  GridList,
  GridListItem,
} from "@/client/components/shared/atoms/GridList";
import { ProviderIcon } from "@/client/components/shared/atoms/ProviderIcon";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";

export type ProviderGridItem = {
  id: string;
  icon?: string;
  name: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
};

export function ProviderGridList({
  items,
  label,
  onAction,
  isLoading,
  skeletonCount = 2,
  emptyMessage,
  disabledKeys,
}: {
  items: ProviderGridItem[];
  label: string;
  onAction: (key: Key) => void;
  isLoading: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
  disabledKeys?: Iterable<Key>;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border py-4"
          >
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0 && emptyMessage) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8">
        <p className="text-base text-subtle-text">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <GridList
      aria-label={label}
      onAction={onAction}
      disabledKeys={disabledKeys}
    >
      {items.map((item) => (
        <GridListItem key={item.id} id={item.id} textValue={item.name}>
          <ProviderIcon icon={item.icon} name={item.name} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-medium text-main-black">
              {item.name}
            </span>
            {item.subtitle && item.subtitle}
          </div>
          {item.trailing}
        </GridListItem>
      ))}
    </GridList>
  );
}
