import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
  HouseSimpleIcon,
  ChatDotsIcon,
  ChartLineIcon,
  PlugIcon,
  GearSixIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { TooltipTrigger } from "react-aria-components";
import { Button } from "@/client/components/shared/atoms/Button";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { Link } from "@/client/components/shared/atoms/Link";
import {
  Menu,
  MenuItem,
  MenuTrigger,
} from "@/client/components/shared/atoms/Menu";
import { Tooltip } from "@/client/components/shared/atoms/Tooltip";
import { signOut, useSession } from "@/client/lib/auth-client";
import { useAppConfig } from "@/client/hooks/useAppConfig";
import terraLogo from "@/client/assets/terra-logo-sidebar.svg";

interface SidebarItemProps {
  to: string;
  icon: ComponentType<IconProps>;
  label: string;
  fuzzy?: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
}

function SidebarItem({
  to,
  icon: Icon,
  label,
  fuzzy = true,
  disabled = false,
  disabledTooltip,
}: SidebarItemProps) {
  const matchRoute = useMatchRoute();
  const isActive = !disabled && !!matchRoute({ to, fuzzy });

  if (disabled) {
    return (
      <TooltipTrigger delay={0} closeDelay={0}>
        <span
          aria-label={label}
          aria-disabled="true"
          className="flex items-center justify-center size-10 rounded-md text-secondary-text/40 cursor-not-allowed"
        >
          <Icon size={24} />
        </span>
        <Tooltip placement="right">{disabledTooltip ?? label}</Tooltip>
      </TooltipTrigger>
    );
  }

  return (
    <TooltipTrigger delay={0} closeDelay={0}>
      <Link
        to={to}
        variant="sidebar"
        aria-label={label}
        className={
          isActive ? "bg-emphasis-bg cursor-default pointer-events-none" : ""
        }
      >
        <Icon size={24} className={isActive ? "text-emphasis" : ""} />
      </Link>
      <Tooltip placement="right">{label}</Tooltip>
    </TooltipTrigger>
  );
}

const navItems: SidebarItemProps[] = [
  { to: "/dashboard", icon: HouseSimpleIcon, label: "Home", fuzzy: false },
  { to: "/chat", icon: ChatDotsIcon, label: "Chat" },
  { to: "/trends", icon: ChartLineIcon, label: "Trends" },
];

function ProfileMenu() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const initial =
    (session?.user?.name || session?.user?.email)?.charAt(0).toUpperCase() ??
    "?";

  const displayName = session?.user?.name || session?.user?.email || "Profile";

  return (
    <MenuTrigger placement="top start">
      <TooltipTrigger delay={0} closeDelay={0}>
        <Button
          variant="quiet"
          aria-label="Profile menu"
          className="size-10 p-0 rounded-full bg-emphasis-bg hover:bg-emphasis-bg-hover pressed:bg-emphasis-bg-pressed border border-emphasis-secondary text-emphasis font-semibold text-base"
        >
          {initial}
        </Button>
        <Tooltip placement="right">{displayName}</Tooltip>
      </TooltipTrigger>
      <Menu>
        <MenuItem onAction={() => navigate({ to: "/connectors" })}>
          <PlugIcon size={20} />
          Connectors
        </MenuItem>
        <MenuItem onAction={() => navigate({ to: "/settings" })}>
          <GearSixIcon size={20} />
          Settings
        </MenuItem>
        <MenuItem
          onAction={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => window.location.replace("/"),
              },
            })
          }
        >
          <SignOutIcon size={20} />
          Log out
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );
}

function SidebarLogo() {
  return (
    <img
      src={terraLogo}
      alt="Terra"
      className="size-10 rounded-md border border-border"
    />
  );
}

function SidebarNav() {
  const { data: config } = useAppConfig();
  const chatDisabled = config?.chatEnabled === false;

  return (
    <div className="flex flex-col gap-2 w-full">
      {navItems.map((item) => (
        <SidebarItem
          key={item.to}
          {...item}
          disabled={item.to === "/chat" && chatDisabled}
          disabledTooltip={
            item.to === "/chat"
              ? "AI chat is off — no Anthropic key configured"
              : undefined
          }
        />
      ))}
    </div>
  );
}

export function Sidebar() {
  return (
    <nav className="flex flex-col justify-between items-center shrink-0 h-full bg-white border-r border-border p-4">
      <div className="flex flex-col gap-4 w-full items-center">
        <SidebarLogo />
        <hr className="w-full border-border" />
        <SidebarNav />
      </div>
      <ProfileMenu />
    </nav>
  );
}
