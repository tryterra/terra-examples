import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
  HouseIcon,
  ChatDotsIcon,
  ChartLineIcon,
  ListIcon,
  PlugIcon,
  GearSixIcon,
  SignOutIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { useState, type ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { Button } from "@/client/components/shared/atoms/Button";
import {
  GridList,
  GridListItem,
} from "@/client/components/shared/atoms/GridList";
import { Link } from "@/client/components/shared/atoms/Link";
import { Sheet } from "@/client/components/shared/atoms/Sheet";
import { signOut } from "@/client/lib/auth-client";
import { useAppConfig } from "@/client/hooks/useAppConfig";

const moreSheetItems = [
  { id: "connectors", icon: PlugIcon, label: "Connectors", to: "/connectors" },
  { id: "settings", icon: GearSixIcon, label: "Settings", to: "/settings" },
  { id: "logout", icon: SignOutIcon, label: "Log out" },
];

interface MobileNavItemProps {
  to: string;
  icon: ComponentType<IconProps>;
  label: string;
  fuzzy?: boolean;
  disabled?: boolean;
}

function MobileNavItem({
  to,
  icon: Icon,
  label,
  fuzzy = true,
  disabled = false,
}: MobileNavItemProps) {
  const matchRoute = useMatchRoute();
  const isActive = !disabled && !!matchRoute({ to, fuzzy });

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-col items-center gap-1 shrink-0 rounded-lg opacity-40 cursor-not-allowed"
      >
        <div className="flex items-center justify-center size-9 rounded-lg">
          <Icon size={24} weight="bold" className="text-secondary-text" />
        </div>
        <span className="text-sm font-medium text-secondary-text">{label}</span>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className={`group flex flex-col items-center gap-1 shrink-0 no-underline rounded-lg ${isActive ? "pointer-events-none" : ""}`}
    >
      <div
        className={`flex items-center justify-center size-9 rounded-lg transition ${isActive ? "bg-emphasis-bg" : "group-hover:bg-hover-grey group-pressed:bg-pressed-grey"}`}
      >
        <Icon
          size={24}
          weight="bold"
          className={isActive ? "text-emphasis" : "text-secondary-text"}
        />
      </div>
      <span
        className={`text-sm font-medium ${isActive ? "text-emphasis" : "text-secondary-text"}`}
      >
        {label}
      </span>
    </Link>
  );
}

function MobileMoreSheet() {
  const [isOpen, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Button
        aria-label="More menu"
        variant="quiet"
        className="group flex flex-col items-center gap-1 shrink-0 bg-transparent hover:bg-transparent pressed:bg-transparent border-none shadow-none rounded-lg p-0 h-auto"
        onPress={() => setOpen(true)}
      >
        <div className="flex items-center justify-center size-9 rounded-lg transition group-hover:bg-hover-grey group-pressed:bg-pressed-grey">
          <ListIcon size={24} weight="bold" className="text-secondary-text" />
        </div>
        <span className="text-sm font-medium text-secondary-text">More</span>
      </Button>
      <Sheet isOpen={isOpen} onOpenChange={setOpen} title="More">
        <GridList
          aria-label="More options"
          onAction={(key) => {
            if (key === "logout") {
              signOut({
                fetchOptions: {
                  onSuccess: () => window.location.replace("/"),
                },
              });
            } else {
              const item = moreSheetItems.find((i) => i.id === key);
              if (item?.to) {
                navigate({ to: item.to });
                setOpen(false);
              }
            }
          }}
        >
          {moreSheetItems.map((item) => (
            <GridListItem key={item.id} id={item.id} textValue={item.label}>
              <item.icon size={24} />
              <span className="flex-1">{item.label}</span>
              <CaretRightIcon size={20} className="text-emphasis" />
            </GridListItem>
          ))}
        </GridList>
      </Sheet>
    </>
  );
}

export function MobileNavbar() {
  const { data: config } = useAppConfig();
  const chatDisabled = config?.chatEnabled === false;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-border px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
      <MobileNavItem
        to="/dashboard"
        icon={HouseIcon}
        label="Home"
        fuzzy={false}
      />
      <MobileNavItem
        to="/chat"
        icon={ChatDotsIcon}
        label="Chat"
        disabled={chatDisabled}
      />
      <MobileNavItem to="/trends" icon={ChartLineIcon} label="Trends" />
      <MobileMoreSheet />
    </nav>
  );
}
