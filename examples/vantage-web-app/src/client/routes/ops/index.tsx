import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { overviewQuery } from "../../lib/queries";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { KpiCard } from "../../components/pages/ops/KpiCard";
import { WebhookFailureChart } from "../../components/pages/ops/WebhookFailureChart";
import type { OverviewOk } from "../../components/pages/ops/api-types";

export const Route = createFileRoute("/ops/")({ component: Overview });

function Overview() {
  const { data, isLoading } = useQuery(overviewQuery);
  const overview = data as OverviewOk | undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold text-main-black">Operations</h1>

      {isLoading || !overview ? (
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Orders (7d)" value={overview.orders.total} />
          <KpiCard
            label="In progress"
            value={overview.orders.by_status["order.processing"] ?? 0}
            tone="emphasis"
            sublabel={<span className="font-mono">order.processing</span>}
          />
          <KpiCard
            label="Missing results"
            value={overview.results.missing}
            warn={overview.results.missing > 0}
            link={
              overview.results.missing > 0
                ? { to: "/ops/orders", search: { missing: true } }
                : undefined
            }
          />
          <KpiCard
            label="Webhook failures"
            value={overview.webhooks.failed_total}
            warn={overview.webhooks.failed_total > 0}
          />
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
        <h2 className="text-base font-semibold text-main-black">
          Webhook failures (daily)
        </h2>
        {isLoading || !overview ? (
          <Skeleton className="h-[240px]" />
        ) : (
          <WebhookFailureChart daily={overview.webhooks.daily} />
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
        <h2 className="text-base font-semibold text-main-black">
          Orders by status
        </h2>
        {isLoading || !overview ? (
          <Skeleton className="h-24" />
        ) : Object.keys(overview.orders.by_status).length === 0 ? (
          <p className="text-sm text-subtle-text">No orders in this window.</p>
        ) : (
          <div className="flex flex-col">
            {Object.entries(overview.orders.by_status)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between border-b border-border py-2.5 last:border-0"
                >
                  <StatusBadge status={status} />
                  <span className="text-sm font-medium text-main-black">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
