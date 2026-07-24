import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "../../shared/atoms/EmptyState";

interface Point {
  date: string;
  failed: number;
}

/** Daily webhook-failure line. Dark-pill tooltip; empty window shows a zero state. */
export function WebhookFailureChart({ daily }: { daily: Point[] }) {
  if (daily.length === 0) {
    return <EmptyState>No webhook failures in this window</EmptyState>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={daily}
        margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--color-subtle-text)", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--color-subtle-text)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          content={<PillTooltip />}
        />
        <Line
          type="monotone"
          dataKey="failed"
          stroke="var(--color-emphasis)"
          strokeWidth={2}
          dot={{
            fill: "var(--color-emphasis)",
            stroke: "white",
            strokeWidth: 2,
            r: 4,
          }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PillTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-main-black px-3 py-2 text-xs text-white shadow-card">
      <div className="font-medium">{label}</div>
      <div className="text-white/80">
        {payload[0].value} failed{" "}
        {payload[0].value === 1 ? "delivery" : "deliveries"}
      </div>
    </div>
  );
}
