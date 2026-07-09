import type { ReactNode } from "react";
import { useStore } from "@tanstack/react-store";
import { useMatches } from "@tanstack/react-router";
import { CloudCheckIcon } from "@phosphor-icons/react";
import { appStore } from "@/client/lib/store";
import {
  Breadcrumbs,
  Breadcrumb,
} from "@/client/components/shared/atoms/Breadcrumbs";
import { Skeleton } from "@/client/components/shared/atoms/Skeleton";
import {
  useTerraConnections,
  useTerraIntegrations,
} from "@/client/hooks/useTerraQueries";
import { useChatList } from "@/client/hooks/useChatQueries";
import { METRICS, type MetricKey } from "@/client/lib/metrics/config";
import { DateNavigator } from "./DateNavigator";

/* ---------------------------------- Slot components --------------------------------- */

const breadcrumbLabels: Record<string, string> = {
  "/_authenticated/dashboard": "Home",
  "/_authenticated/chat": "Chats",
  "/_authenticated/trends": "Trends",
  "/_authenticated/connectors": "Connectors",
  "/_authenticated/settings": "Settings",
};

const CONNECTION_ROUTE_ID = "/_authenticated/connectors/$connectionId";
const METRIC_ROUTE_ID = "/_authenticated/trends/$metric";
const CHAT_ROUTE_ID = "/_authenticated/chat/$chatId";
const NEW_CHAT_ROUTE_ID = "/_authenticated/chat/new";

function ConnectionBreadcrumbLabel() {
  const { data: connectionsData } = useTerraConnections();
  const { data: integrationsData } = useTerraIntegrations();
  const matches = useMatches();
  const match = matches.find((m) => m.routeId === CONNECTION_ROUTE_ID);
  const connectionId = (match?.params as { connectionId?: string })
    ?.connectionId;

  const connection = connectionsData?.connections?.find(
    (c) => c.id === connectionId,
  );
  const provider = integrationsData?.providers?.find(
    (p) => p.provider === connection?.provider,
  );

  if (!provider?.name) return <Skeleton className="h-4 w-16 inline-block" />;
  return <>{provider.name}</>;
}

function MetricBreadcrumbLabel() {
  const matches = useMatches();
  const match = matches.find((m) => m.routeId === METRIC_ROUTE_ID);
  const metricKey = (match?.params as { metric?: string })?.metric;
  const config = metricKey ? METRICS[metricKey as MetricKey] : undefined;
  return <>{config?.title ?? metricKey}</>;
}

function ChatBreadcrumbLabel() {
  const { data } = useChatList();
  const matches = useMatches();
  const match = matches.find((m) => m.routeId === CHAT_ROUTE_ID);
  const chatId = (match?.params as { chatId?: string })?.chatId;
  const chat = data?.chats?.find((c) => c.id === chatId);

  if (!chat?.title) return <Skeleton className="h-4 w-24 inline-block" />;
  return <span className="truncate">{chat.title}</span>;
}

function NavbarBreadcrumbs() {
  const matches = useMatches();
  const dynamicRoutes = new Set([
    CONNECTION_ROUTE_ID,
    METRIC_ROUTE_ID,
    CHAT_ROUTE_ID,
    NEW_CHAT_ROUTE_ID,
  ]);
  const crumbs = matches
    .filter((m) => breadcrumbLabels[m.routeId] || dynamicRoutes.has(m.routeId))
    .map((m) => ({
      id: m.routeId,
      to: m.pathname,
    }));

  return (
    <Breadcrumbs>
      {crumbs.map((crumb) => (
        <Breadcrumb key={crumb.id} to={crumb.to}>
          {breadcrumbLabels[crumb.id] ??
            (crumb.id === METRIC_ROUTE_ID ? (
              <MetricBreadcrumbLabel />
            ) : crumb.id === CHAT_ROUTE_ID ? (
              <ChatBreadcrumbLabel />
            ) : crumb.id === NEW_CHAT_ROUTE_ID ? (
              "New chat"
            ) : (
              <ConnectionBreadcrumbLabel />
            ))}
        </Breadcrumb>
      ))}
    </Breadcrumbs>
  );
}

function NavbarDateNavigator() {
  const selectedDate = useStore(appStore, (s) => s.selectedDate);
  return (
    <DateNavigator
      value={selectedDate}
      onChange={(date) =>
        appStore.setState((s) => ({ ...s, selectedDate: date }))
      }
    />
  );
}

function NavbarSyncStatus() {
  const { data, isLoading } = useTerraConnections();
  if (isLoading || !data) return null;

  const connections = data.connections.filter((c) => c.status === "active");

  const lastSync = connections
    .map((c) => c.lastWebhookAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

  if (!lastSync) return null;

  const syncLabel = `Synced: ${new Date(lastSync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  return (
    <div className="flex items-center gap-2 px-2 h-7">
      <CloudCheckIcon size={16} weight="bold" className="text-subtle-text" />
      <span className="text-sm font-medium text-subtle-text whitespace-nowrap">
        {syncLabel}
      </span>
    </div>
  );
}

/* ---------------------------------- Navbar ------------------------------------------ */

interface NavbarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function Navbar({ left, right, className }: NavbarProps) {
  const leftSlot = useStore(appStore, (s) => s.navbarLeft);
  const centerSlot = useStore(appStore, (s) => s.navbarCenter);
  const rightSlot = useStore(appStore, (s) => s.navbarRight);

  return (
    <nav
      className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 h-10 w-full bg-bg-grey ${className ?? ""}`}
    >
      <div className="flex items-center">
        {left ?? (leftSlot === "breadcrumbs" && <NavbarBreadcrumbs />)}
      </div>
      <div className="flex items-center justify-center">
        {centerSlot === "date-navigator" && <NavbarDateNavigator />}
      </div>
      <div className="flex items-center justify-end">
        {right ?? (rightSlot === "sync-status" && <NavbarSyncStatus />)}
      </div>
    </nav>
  );
}
