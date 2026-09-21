import { Skeleton } from "@/client/components/shared/atoms/Skeleton";

export function SettingsPageSkeleton() {
  return (
    <div className="flex justify-center py-32 px-4">
      <div className="flex flex-col gap-16 w-2xl">
        <Skeleton className="h-10 w-48" />

        <section className="flex flex-col gap-8">
          <Skeleton className="h-5 w-52" />
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-12 w-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </section>

        <section className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </section>

        <section className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-12 w-full rounded-full" />
        </section>
      </div>
    </div>
  );
}
