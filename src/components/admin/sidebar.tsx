"use client";

import {
  BoxIcon,
  ChevronDownIcon,
  CompassIcon,
  FileTextIcon,
  HandshakeIcon,
  HomeIcon,
  ImagesIcon,
  InfoIcon,
  LayoutDashboardIcon,
  MailIcon,
  MapPinIcon,
  MenuIcon,
  MessageSquareIcon,
  MegaphoneIcon,
  SettingsIcon,
  Share2Icon,
  ShieldIcon,
  ShoppingBagIcon,
  StoreIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SidebarIcon, SidebarItem } from "@/config/sidebar";
import { cn } from "@/lib/utils";

const ICONS: Record<SidebarIcon, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  product: BoxIcon,
  order: ShoppingBagIcon,
  customer: UsersIcon,
  marketing: MegaphoneIcon,
  share: Share2Icon,
  curate: CompassIcon,
  store: StoreIcon,
  post: FileTextIcon,
  comment: MessageSquareIcon,
  contact: MailIcon,
  user: ShieldIcon,
  slide: ImagesIcon,
  menu: MenuIcon,
  distribution: MapPinIcon,
  home: HomeIcon,
  dealer: HandshakeIcon,
  info: InfoIcon,
  settings: SettingsIcon,
};

/** Menu trai: nhom dang mo theo segment dau cua URL (giong sidebar.blade.php). */
export function SidebarNav({ items: sidebar, onNavigate }: { items: SidebarItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const [open, setOpen] = useState<Set<string>>(() => new Set(sidebar.filter((s) => s.name.includes(segment)).map((s) => s.title)));
  // Muc con dang mo: route co "goc" (bo /index) khop dai nhat voi URL hien tai
  const activeSub = sidebar
    .flatMap((s) => s.subModule ?? [])
    .map((s) => ({ route: s.route, base: s.route.replace(/\/index$/, "") }))
    .filter((s) => pathname === s.route || pathname === s.base || pathname.startsWith(`${s.base}/`))
    .sort((a, b) => b.base.length - a.base.length)[0]?.route;

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      {sidebar.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.name.includes(segment);
        if (!item.subModule) {
          return (
            <Link
              key={item.title}
              href={item.route ?? "#"}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-primary text-white" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.title}
            </Link>
          );
        }
        const expanded = open.has(item.title);
        return (
          <div key={item.title}>
            <button
              type="button"
              // Kieu accordion: mo nhom nay thi dong cac nhom khac de menu khong dai qua man hinh
              onClick={() => setOpen((prev) => (prev.has(item.title) ? new Set() : new Set([item.title])))}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                active ? "text-white" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <ChevronDownIcon className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")} />
            </button>
            {/* grid-rows 0fr -> 1fr: mo/dong muot theo chieu cao that, khong can do bang JS */}
            <div
              inert={!expanded}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
              <div className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-sidebar-accent pl-3">
                {item.subModule.map((sub) => {
                  const subActive = sub.route === activeSub;
                  return (
                    <Link
                      key={sub.route}
                      href={sub.route}
                      onClick={onNavigate}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-[13px] transition-colors",
                        subActive ? "bg-sidebar-accent font-medium text-white" : "text-sidebar-muted hover:text-white",
                      )}
                    >
                      {sub.title}
                    </Link>
                  );
                })}
              </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
