import {
  ClockCounterClockwiseIcon,
  PlugIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { TooltipTrigger } from "react-aria-components";
import { Button } from "@/client/components/shared/atoms/Button";
import { Link } from "@/client/components/shared/atoms/Link";
import { Tooltip } from "@/client/components/shared/atoms/Tooltip";
import { useState, useMemo, useEffect } from "react";
import { EmptyState } from "@/client/components/shared/atoms/EmptyState";
import { Select, SelectItem } from "@/client/components/shared/atoms/Select";
import { appStore } from "@/client/lib/store";
import { ActivityItem } from "@/client/components/pages/dashboard/ActivityItem";
import { BiomarkerCard } from "@/client/components/pages/dashboard/BiomarkerCard";
import { ConnectionErrorBanner } from "@/client/components/pages/dashboard/ConnectionErrorBanner";
import {
  CustomizeScoresModal,
  CustomizeBiomarkersModal,
} from "@/client/components/pages/dashboard/CustomizeDashboardModal";
import {
  ActivitiesSkeleton,
  BiomarkerCardsSkeleton,
  ScoreCardsSkeleton,
} from "@/client/components/pages/dashboard/DashboardSkeletons";
import { ScoreCard } from "@/client/components/pages/dashboard/ScoreCard";
import {
  useDashboardActivities,
  useTerraConnections,
  useTerraDashboard,
  useTerraIntegrations,
} from "@/client/hooks/useTerraQueries";
import { useDashboardConfig } from "@/client/hooks/useDashboardConfig";
import { useCreateChat } from "@/client/hooks/useChatQueries";
import { ChatInput } from "@/client/components/pages/chat/ChatInput";

import {
  SCORE_DISPLAY,
  CUSTOMIZABLE_SCORES,
} from "@/client/lib/dashboard/config";
import { METRICS, DASHBOARD_BIOMARKERS } from "@/client/lib/metrics/config";
import { deduplicateV2Scores } from "@/client/lib/dashboard/scores";
import type { Activity, ScoreField } from "@/client/lib/dashboard/types";
import { formatDateHeading } from "@/client/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Resolves Terra provider codes (e.g. "GOOGLE_FIT") to display names. */
function useProviderResolver() {
  const { data } = useTerraIntegrations();
  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.providers ?? []) {
      if (p.provider && p.name) map.set(p.provider, p.name);
    }
    return map;
  }, [data]);
  return (provider: string) => nameMap.get(provider) ?? provider;
}

/** Groups a flat list of activities into date-keyed sections (Today, Yesterday, etc.). */
function groupActivitiesByDate(activities: Activity[]) {
  const groups: { date: string; label: string; items: Activity[] }[] = [];
  for (const a of activities) {
    const dateKey = new Date(a.startTime).toDateString();
    const last = groups[groups.length - 1];
    if (last?.date === dateKey) {
      last.items.push(a);
    } else {
      groups.push({
        date: dateKey,
        label: formatDateHeading(a.startTime),
        items: [a],
      });
    }
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const resolveProvider = useProviderResolver();

  /* ---------------------------------- Chat ---------------------------------- */

  const createChat = useCreateChat();
  const { data: connectionsCountData } = useTerraConnections();
  const activeConnectionCount =
    connectionsCountData?.connections?.filter((c) => c.status === "active")
      .length ?? 0;

  async function handleChatSubmit(text: string, files?: FileList) {
    if (!text.trim() && !files?.length) return;
    const result = await createChat.mutateAsync();
    appStore.setState((s) => ({ ...s, pendingChatMessage: { text, files } }));
    navigate({ to: "/chat/$chatId", params: { chatId: result.id } });
  }

  /* ----------------------------- Dashboard data ----------------------------- */

  const [scoreConnectionId, setScoreConnectionId] = useState<
    string | undefined
  >();
  const [scoresModalOpen, setScoresModalOpen] = useState(false);
  const [biomarkersModalOpen, setBiomarkersModalOpen] = useState(false);
  const selectedDate = useStore(appStore, (s) => s.selectedDate);
  const { data, isLoading } = useTerraDashboard(
    scoreConnectionId,
    selectedDate,
  );
  const { data: configData } = useDashboardConfig();
  const {
    data: activitiesData,
    isPending: activitiesPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useDashboardActivities();

  useEffect(() => {
    appStore.setState((s) => ({ ...s, navbarCenter: "date-navigator" }));
    return () => appStore.setState((s) => ({ ...s, navbarCenter: null }));
  }, []);

  /* ------------------------------ Derived state ----------------------------- */

  const connected = data?.connected === true;
  const showData = isLoading || connected;
  const connections = connected ? data.connections : [];
  const scores = connected ? data.scores : null;
  const biomarkers = connected ? data.biomarkers : null;
  const erroredConnections = connections.filter((c) => c.status === "error");
  const showProvider = connections.length > 1;

  const selectedScoreKeys = configData?.dashboardConfig?.scores ?? null;
  const selectedBiomarkerKeys = configData?.dashboardConfig?.biomarkers ?? null;

  const scoreCards = useMemo(() => {
    const allEntries: [ScoreField, number][] = [];
    if (scores) {
      for (const source of [scores.daily, scores.sleep]) {
        if (!source) continue;
        for (const key of Object.keys(source) as ScoreField[]) {
          const value = source[key as keyof typeof source];
          if (typeof value === "number") allEntries.push([key, value]);
        }
      }
    }
    const deduped = deduplicateV2Scores(allEntries);
    const scoreMap = new Map(
      deduped.filter(([key]) => SCORE_DISPLAY[key] != null),
    );

    const visibleScores = selectedScoreKeys
      ? CUSTOMIZABLE_SCORES.filter((s) => selectedScoreKeys.includes(s.key))
      : CUSTOMIZABLE_SCORES;

    const cards = visibleScores.map((def) => {
      for (const field of def.terraFields) {
        const val = scoreMap.get(field);
        if (val != null) {
          return {
            title: def.title,
            description: def.description,
            value: Math.round(val) as number | null,
          };
        }
      }
      return { title: def.title, description: def.description, value: null };
    });
    return cards.sort((a, b) => {
      const aHas = a.value != null ? 0 : 1;
      const bHas = b.value != null ? 0 : 1;
      return aHas - bHas;
    });
  }, [scores, selectedScoreKeys]);

  const visibleBiomarkers = useMemo(() => {
    const filtered = selectedBiomarkerKeys
      ? DASHBOARD_BIOMARKERS.filter((key) =>
          selectedBiomarkerKeys.includes(key),
        )
      : DASHBOARD_BIOMARKERS;
    return [...filtered].sort((a, b) => {
      const aHas = typeof biomarkers?.[a]?.value === "number" ? 0 : 1;
      const bHas = typeof biomarkers?.[b]?.value === "number" ? 0 : 1;
      return aHas - bHas;
    });
  }, [selectedBiomarkerKeys, biomarkers]);

  const allActivities = useMemo(
    () => activitiesData?.pages.flatMap((p) => p.activities) ?? [],
    [activitiesData],
  );
  const activityGroups = useMemo(
    () =>
      allActivities.length > 0 ? groupActivitiesByDate(allActivities) : [],
    [allActivities],
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 md:gap-16 px-4 py-32">
      <ConnectionErrorBanner
        providerNames={erroredConnections.map((c) =>
          resolveProvider(c.provider),
        )}
      />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold leading-none text-main-black">
            Welcome {user.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-lg font-medium text-secondary-text">
            Check your latest scores, biomarkers, and activities. Dig deeper
            with AI.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <ChatInput
            onSubmit={handleChatSubmit}
            disabled={createChat.isPending}
          />
          <div className="flex items-center gap-2">
            <Link
              to="/chat"
              variant="button-quiet"
              className="text-subtle-text"
            >
              <ClockCounterClockwiseIcon size={20} />
              Chat history
            </Link>
            <Link
              to="/connectors"
              variant="button-quiet"
              className="text-subtle-text"
            >
              <PlugIcon size={20} className="text-subtle-text" />
              {activeConnectionCount > 0
                ? `${activeConnectionCount} connector${activeConnectionCount === 1 ? "" : "s"}`
                : "Add connectors"}
            </Link>
          </div>
        </div>
      </div>

      {!showData && <EmptyState>No connected sources</EmptyState>}

      {/* --------------------------------- Scores --------------------------------- */}

      {showData && (
        <div className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-main-black">Scores</h2>
              <TooltipTrigger delay={0} closeDelay={0}>
                <Button
                  variant="quiet"
                  size="md"
                  className="rounded-lg"
                  onPress={() => setScoresModalOpen(true)}
                >
                  <WrenchIcon size={24} className="text-subtle-text" />
                </Button>
                <Tooltip>Customize scores</Tooltip>
              </TooltipTrigger>
            </div>
            <p className="text-base text-secondary-text">
              Your health scores at a glance, powered by your connected devices.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {showProvider && (
              <Select
                aria-label="Score source device"
                value={scoreConnectionId ?? scores?.connectionId ?? undefined}
                onChange={(key) => setScoreConnectionId(key as string)}
                className="w-fit"
              >
                {connections.map((conn) => (
                  <SelectItem
                    key={conn.id}
                    id={conn.id}
                    textValue={resolveProvider(conn.provider)}
                  >
                    {resolveProvider(conn.provider)}
                  </SelectItem>
                ))}
              </Select>
            )}

            {isLoading ? (
              <ScoreCardsSkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {scoreCards.map((card) => (
                  <ScoreCard
                    key={card.title}
                    title={card.title}
                    score={card.value}
                    s={
                      card.value != null
                        ? card.value >= 60
                          ? "Good"
                          : "Poor"
                        : null
                    }
                    description={card.description}
                    onExplore={() =>
                      handleChatSubmit(`Tell me about my ${card.title} score.`)
                    }
                    onViewTrends={() => navigate({ to: "/trends" })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------- Biomarkers ------------------------------- */}

      {showData && (
        <div className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-main-black">
                Key biomarkers
              </h2>
              <TooltipTrigger delay={0} closeDelay={0}>
                <Button
                  variant="quiet"
                  size="md"
                  className="rounded-lg"
                  onPress={() => setBiomarkersModalOpen(true)}
                >
                  <WrenchIcon size={24} className="text-subtle-text" />
                </Button>
                <Tooltip>Customize biomarkers</Tooltip>
              </TooltipTrigger>
            </div>
            <p className="text-base text-secondary-text">
              Your vitals, all in one place.
            </p>
          </div>
          {isLoading ? (
            <BiomarkerCardsSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visibleBiomarkers.map((key) => {
                const metric = METRICS[key];
                const raw = biomarkers?.[key] ?? null;
                return (
                  <BiomarkerCard
                    key={key}
                    icon={<metric.icon size={16} className="text-main-black" />}
                    title={metric.title}
                    value={raw ? metric.format(raw.value) : null}
                    unit={metric.unit}
                    s={
                      raw
                        ? metric.dashboard!.goodThreshold(raw.value)
                          ? "Good"
                          : "Poor"
                        : null
                    }
                    source={raw ? resolveProvider(raw.provider) : undefined}
                    metricKey={key}
                    onExplore={() =>
                      handleChatSubmit(`Tell me about my ${metric.title}.`)
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------- Activities ------------------------------- */}

      {showData && (
        <div className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-main-black">
              Latest activities
            </h2>
            <p className="text-base text-secondary-text">
              See your latest activities across all connected health data
              sources.
            </p>
          </div>
          {activitiesPending ? (
            <ActivitiesSkeleton />
          ) : activityGroups.length > 0 ? (
            <>
              <div className="flex flex-col gap-6">
                {activityGroups.map((group) => (
                  <div key={group.date} className="flex flex-col gap-2">
                    <span className="text-base font-medium text-secondary-text">
                      {group.label}
                    </span>
                    <div className="flex flex-col">
                      {group.items.map((activity, i) => (
                        <ActivityItem
                          key={`${activity.startTime}-${i}`}
                          activity={activity}
                          showBorder={i < group.items.length - 1}
                          providerName={
                            showProvider
                              ? resolveProvider(activity.provider)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {hasNextPage && (
                <button
                  type="button"
                  className="flex h-12 w-full items-center justify-center rounded-full bg-main-black text-base font-semibold text-white cursor-pointer transition hover:bg-main-black-hover active:bg-main-black-pressed disabled:opacity-50"
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  Show more
                </button>
              )}
            </>
          ) : (
            <EmptyState>No activities yet</EmptyState>
          )}
        </div>
      )}

      {/* ----------------------------- Customize Modals ----------------------------- */}

      <CustomizeScoresModal
        isOpen={scoresModalOpen}
        onOpenChange={setScoresModalOpen}
      />
      <CustomizeBiomarkersModal
        isOpen={biomarkersModalOpen}
        onOpenChange={setBiomarkersModalOpen}
      />
    </div>
  );
}
