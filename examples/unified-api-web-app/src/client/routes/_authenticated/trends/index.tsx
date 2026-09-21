import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState } from "@/client/components/shared/atoms/EmptyState";
import { MetricCard } from "@/client/components/pages/trends/MetricCard";
import { MetricGridSkeleton } from "@/client/components/pages/trends/TrendsSkeletons";
import {
  terraTrendsAvailableQueryOpts,
  useTerraTrendsAvailable,
} from "@/client/hooks/useTerraQueries";
import { queryClient } from "@/client/lib/query-client";
import { METRICS, type MetricKey } from "@/client/lib/metrics/config";

export const Route = createFileRoute("/_authenticated/trends/")({
  component: TrendsIndexPage,
  loader: () => {
    queryClient.prefetchQuery(terraTrendsAvailableQueryOpts);
  },
});

function TrendsIndexPage() {
  const { data, isLoading } = useTerraTrendsAvailable();

  const { biomarkers, scores } = useMemo(() => {
    const available = new Set(data?.available ?? []);
    const bio: MetricKey[] = [];
    const scr: MetricKey[] = [];
    for (const [key, cfg] of Object.entries(METRICS)) {
      if (!available.has(key)) continue;
      if (cfg.category === "biomarker") bio.push(key as MetricKey);
      else scr.push(key as MetricKey);
    }
    return { biomarkers: bio, scores: scr };
  }, [data]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 md:gap-16 px-4 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold leading-none text-main-black">
          Trends
        </h1>
        <p className="text-lg font-medium text-secondary-text">
          Explore how your health metrics change over time.
        </p>
      </div>

      {isLoading ? (
        <MetricGridSkeleton />
      ) : biomarkers.length === 0 && scores.length === 0 ? (
        <EmptyState>No metric data available yet</EmptyState>
      ) : (
        <>
          {biomarkers.length > 0 && (
            <div className="flex flex-col gap-8 border-t border-border pt-16">
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-main-black">
                  Biomarkers
                </h2>
                <p className="text-base text-secondary-text">
                  Track your vitals over time.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {biomarkers.map((key) => {
                  const cfg = METRICS[key];
                  return (
                    <MetricCard
                      key={key}
                      to={`/trends/${key}`}
                      icon={<cfg.icon size={20} className="text-emphasis" />}
                      title={cfg.title}
                      unit={cfg.unit}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {scores.length > 0 && (
            <div className="flex flex-col gap-8 border-t border-border pt-16">
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-main-black">
                  Scores
                </h2>
                <p className="text-base text-secondary-text">
                  Monitor your health scores and indices.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {scores.map((key) => {
                  const cfg = METRICS[key];
                  return (
                    <MetricCard
                      key={key}
                      to={`/trends/${key}`}
                      icon={<cfg.icon size={20} className="text-emphasis" />}
                      title={cfg.title}
                      unit={cfg.unit}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
