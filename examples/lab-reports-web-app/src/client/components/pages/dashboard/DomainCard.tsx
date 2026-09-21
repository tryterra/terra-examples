/**
 * Analysis domain card: SVG gauge (Terra Basecamp ScoreCard idiom) + the
 * deterministic narrative + a "Why this score" table of every contribution.
 * The header links to the domain's own dashboard (score timeline + granular
 * metric charts), and every contribution links to its metric's trend view.
 */
import { Link } from "@tanstack/react-router";
import { CaretRightIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import { Badge } from "../../shared/atoms/Badge";
import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
} from "../../shared/atoms/Disclosure";
import { Sparkline } from "../../shared/Sparkline";
import type { AnalysisOk } from "../../../lib/queries";

export type Domain = AnalysisOk["domains"][number];
export type DomainHistoryPoint = AnalysisOk["history"][string][number];
type Contribution = Domain["contributions"][number];

export function ScoreGauge({
  score,
  poor,
  size = 100,
}: {
  score: number | null;
  poor: boolean;
  size?: number;
}) {
  const cx = 58.3;
  const cy = 58.3;
  const r = 54.3;
  const stroke = 6;
  const hasData = score != null;
  const pct = score == null ? 0 : Math.min(Math.max(score / 100, 0), 1);
  const color = poor ? "var(--color-warning)" : "var(--color-emphasis)";

  // ~267° ring with a ~93° gap centred at the bottom; the knob marks the score.
  const gap = 93;
  const startAngle = 180 + gap / 2;
  const sweep = 360 - gap;

  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  const [x1, y1] = point(startAngle);
  const [x2, y2] = point(startAngle + sweep);
  const arc = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  const [knobX, knobY] = point(startAngle + pct * sweep);

  return (
    <svg
      viewBox="0 0 116.6 98.55"
      width={size}
      height={size * 0.845}
      className="overflow-visible"
    >
      <path
        d={arc}
        fill="none"
        stroke="var(--color-main-black)"
        strokeWidth={stroke + 2}
        strokeLinecap="round"
      />
      <path
        d={arc}
        fill="none"
        stroke={hasData ? color : "var(--color-border)"}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <circle
        cx={knobX}
        cy={knobY}
        r={9.3}
        fill="white"
        stroke="var(--color-main-black)"
        strokeWidth={2}
      />
    </svg>
  );
}

/** Trend deep-link for a contribution, when its metric has one. */
function contributionLink(
  c: Contribution,
): { to: string; search: Record<string, unknown> } | null {
  if (!c.ref) return null;
  if (c.ref.type === "lab") {
    return {
      to: "/patients/$patientId/lab-trends",
      search: { biomarkers: c.ref.biomarkerKey },
    };
  }
  return {
    to: "/patients/$patientId/wearables",
    search: { metric: c.ref.metric, days: 30 },
  };
}

export function DomainCard({
  domain,
  patientId,
  history = [],
}: {
  domain: Domain;
  patientId: string;
  history?: DomainHistoryPoint[];
}) {
  const hasData = domain.score != null;
  const poor = domain.status === "Poor" || domain.status === "Fair";
  const historyScores = history
    .map((h) => h.score)
    .filter((s): s is number => s != null);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[10px] border border-border">
      <Link
        to="/patients/$patientId/domains/$domainKey"
        params={{ patientId, domainKey: domain.key }}
        className={`group flex items-end justify-between p-4 transition-shadow hover:shadow-card ${
          !hasData ? "bg-bg-grey" : poor ? "bg-warning-bg" : "bg-emphasis-bg"
        }`}
      >
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-lg font-semibold text-main-black">
            {domain.label}
            <CaretRightIcon
              size={16}
              className="text-subtle-text transition-transform group-hover:translate-x-0.5"
            />
          </span>
          {historyScores.length >= 2 && (
            <div className="flex flex-col gap-0.5">
              <Sparkline values={historyScores} warn={poor} />
              <span className="text-[10px] font-medium tracking-wider text-subtle-text uppercase">
                {historyScores.length} reports
              </span>
            </div>
          )}
        </div>
        <div className="relative flex items-center justify-center">
          <ScoreGauge score={domain.score} poor={poor} size={116} />
          <div className="absolute inset-0 flex translate-y-4 flex-col items-center justify-center">
            <span className="text-5xl font-semibold leading-tight text-main-black">
              {hasData ? domain.score : "–"}
            </span>
            <span className="text-base text-secondary-text">
              {hasData ? domain.status : "–"}
            </span>
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 border-t border-border bg-white p-4">
        <div>
          {hasData ? (
            <Badge variant={poor ? "warning" : "emphasis"}>
              {poor && <ShieldWarningIcon size={16} weight="bold" />}
              {domain.status}
            </Badge>
          ) : (
            <Badge variant="neutral">Insufficient data</Badge>
          )}
        </div>
        {domain.narrative.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-sm text-secondary-text">
            {domain.narrative.map((sentence, i) => (
              <li key={i}>{sentence}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-subtle-text">
            No lab or wearable inputs for this domain yet.
          </p>
        )}
        {domain.contributions.length > 0 && (
          <div className="mt-auto">
            <Disclosure>
              <DisclosureHeader>Why this score</DisclosureHeader>
              <DisclosurePanel>
                <div className="flex flex-col text-xs">
                  <div className="grid grid-cols-[1.4fr_auto_1fr_auto_auto] gap-2 border-b border-border pb-1 font-medium text-subtle-text">
                    <span>Input</span>
                    <span>Source</span>
                    <span>Value</span>
                    <span>Score</span>
                    <span>Weight</span>
                  </div>
                  {domain.contributions.map((c, i) => {
                    const link = contributionLink(c);
                    return (
                      <div
                        key={`${c.label}-${i}`}
                        className="grid grid-cols-[1.4fr_auto_1fr_auto_auto] items-center gap-2 border-b border-border py-1.5 last:border-b-0"
                      >
                        {link ? (
                          <Link
                            to={link.to}
                            params={{ patientId }}
                            search={link.search}
                            className="text-main-black underline decoration-border underline-offset-2 hover:text-emphasis hover:decoration-emphasis"
                          >
                            {c.label}
                          </Link>
                        ) : (
                          <span className="text-main-black">{c.label}</span>
                        )}
                        <Badge variant="neutral" className="text-[10px]">
                          {c.kind}
                        </Badge>
                        <span className="text-secondary-text">{c.valueText}</span>
                        <span
                          className={
                            c.severity === "normal"
                              ? "text-main-black"
                              : "font-semibold text-warning"
                          }
                        >
                          {c.subscore}
                        </span>
                        <span className="text-subtle-text">×{c.weight}</span>
                      </div>
                    );
                  })}
                </div>
              </DisclosurePanel>
            </Disclosure>
          </div>
        )}
      </div>
    </div>
  );
}
