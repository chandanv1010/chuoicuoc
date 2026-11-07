"use client";

import { ExternalLinkIcon, LogOutIcon, MenuIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { SidebarItem } from "@/config/sidebar";
import { SidebarNav } from "./sidebar";

export type ShellLanguage = { id: string; name: string; canonical: string; image: string; current: boolean };

function Brand() {
  return (
    <Link href="/dashboard/index" className="flex h-14 items-center gap-2 px-6 text-base font-semibold text-white">
      <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold">NC</span>
      Next Core
    </Link>
  );
}

/** Sidebar co dinh ben trai (man hinh lon). */
export function DesktopSidebar({ nav }: { nav: SidebarItem[] }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
      <Brand />
      <div className="sidebar-scroll flex-1 overflow-y-auto">
        <SidebarNav items={nav} />
      </div>
    </aside>
  );
}

/** Thanh tren: nut mo menu (mobile), doi ngon ngu, tai khoan. */
export function Topbar({ languages, userName, email, nav }: { languages: ShellLanguage[]; userName: string; email: string; nav: SidebarItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
        <MenuIcon />
      </Button>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent showClose={false} className="top-0 left-0 h-full max-h-none w-72 max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-sidebar p-0 duration-300 ease-out data-[state=closed]:zoom-out-100 data-[state=closed]:slide-out-to-left data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-left">
          <DialogTitle className="sr-only">Menu quản trị</DialogTitle>
          <Brand />
          <div className="sidebar-scroll flex-1 overflow-y-auto">
            <SidebarNav items={nav} onNavigate={() => setMobileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1" />

      {/* Doi ngon ngu quan tri: GET /language/{id}/switch (giong nav.blade.php) */}
      <div className="flex items-center gap-1">
        {languages.map((l) => (
          <a
            key={l.id}
            href={`/language/${l.id}/switch`}
            title={l.name}
            className={cn(
              "flex size-8 items-center justify-center overflow-hidden rounded-md border transition-opacity",
              l.current ? "border-primary ring-2 ring-primary/30" : "opacity-60 hover:opacity-100",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.image ? <img src={l.image} alt={l.name} className="size-full object-cover" /> : <span className="text-[10px] uppercase">{l.canonical}</span>}
          </a>
        ))}
      </div>

      <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
        <a href="/" target="_blank" rel="noreferrer">
          <ExternalLinkIcon /> Xem website
        </a>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserIcon className="size-4" />
            </span>
            <span className="hidden max-w-40 truncate sm:inline">{userName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="truncate text-sm font-medium text-foreground">{userName}</div>
            <div className="truncate text-xs font-normal">{email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild variant="destructive">
            <a href="/logout">
              <LogOutIcon /> Đăng xuất
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/** Flash 'success' / 'error' (->with(...)) hien thanh toast, thay toastr. */
export function FlashToast({ success, error }: { success?: string; error?: string }) {
  useEffect(() => {
    if (success) toast.success(success);
    if (error) toast.error(error);
  }, [success, error]);
  return null;
}
