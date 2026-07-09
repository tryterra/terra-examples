import { Store } from "@tanstack/store";

type NavbarLeftSlot = "breadcrumbs" | null;
type NavbarCenterSlot = "date-navigator" | null;
type NavbarRightSlot = "sync-status" | null;

interface PendingChatMessage {
  text: string;
  files?: FileList;
}

interface AppState {
  sidebarOpen: boolean;
  navbarLeft: NavbarLeftSlot;
  navbarCenter: NavbarCenterSlot;
  navbarRight: NavbarRightSlot;
  selectedDate: string;
  pendingChatMessage: PendingChatMessage | null;
}

export const appStore = new Store<AppState>({
  sidebarOpen: false,
  navbarLeft: "breadcrumbs",
  navbarCenter: null,
  navbarRight: "sync-status",
  selectedDate: new Date().toISOString().slice(0, 10),
  pendingChatMessage: null,
});
