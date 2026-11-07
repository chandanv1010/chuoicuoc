"use client";

import { ChevronDown, MapPin, Menu, Search, UserRound, X } from "lucide-react";
import { useRef, useState } from "react";
import { SITE_DESIGN_ENABLED } from "@/modules/design/config";
import { BrandLogo } from "./brand";

/**
 * Header kieu Amazon: logo, "Giao den", o tim kiem co chon danh muc, Tai khoan,
 * thanh sub-nav va ngan keo "Tat ca" (danh muc + tai khoan).
 * Chuc nang gio hang da tat cho site nay (catalog, khong ban online).
 */
export type HeaderProps = {
  customer: { name: string } | null;
  cartCount: number;
  categories: { id: number; name: string; href: string; children?: { id: number; name: string; href: string }[] }[];
  search: { keyword: string; catalogueId: number | null };
  /** Ten shop (siteName() o SiteFrame) */
  shopName: string;
};

// Menu chinh: Trang chu + danh muc goc + cac trang thong tin
const HOME_LINK = { label: "Trang chủ", href: "/" };
export const INFO_LINKS = [
  ...(SITE_DESIGN_ENABLED ? [{ label: "Thiết kế", href: "/design" }] : []),
  { label: "Giới thiệu", href: "/about.html" },
  { label: "Khuyến mãi", href: "/promotions" },
  { label: "Tin tức", href: "/news.html" },
  { label: "Liên hệ", href: "/contact.html" },
];

export function Header({ customer, categories, search, shopName }: HeaderProps) {
  const [drawer, setDrawer] = useState(false);
  const firstName = customer?.name.trim().split(/\s+/)[0] ?? "";

  return (
    <header className="text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2 focus:text-az-text">
        Bỏ qua tới nội dung chính
      </a>
      {/* Thanh chinh */}
      <div className="bg-az-header">
        <div className="flex items-center gap-1 px-2 py-1.5 md:gap-2 md:px-3">
          <button
            type="button"
            className="rounded-sm border border-transparent p-1.5 hover:border-white md:hidden"
            aria-label="Mở menu"
            onClick={() => setDrawer(true)}
          >
            <Menu className="size-7" aria-hidden="true" />
          </button>
          <Logo shopName={shopName} />
          <a
            href="/contact.html"
            className="hidden shrink-0 items-end gap-0.5 rounded-sm border border-transparent px-2 py-1 hover:border-white lg:flex"
          >
            <MapPin className="mb-0.5 size-4" aria-hidden="true" />
            <span className="leading-tight">
              <span className="block text-xs text-white/70">Giao đến</span>
              <span className="block text-sm font-bold">Toàn quốc</span>
            </span>
          </a>

          <div className="hidden min-w-0 flex-1 md:block">
            <SearchForm categories={categories} search={search} shopName={shopName} />
          </div>

          <div className="ml-auto flex items-center md:ml-0">
            <AccountMenu customer={customer} firstName={firstName} />
          </div>
        </div>
        {/* Mobile: o tim kiem duoi logo */}
        <div className="px-2 pb-2 md:hidden">
          <SearchForm categories={categories} search={search} shopName={shopName} compact />
        </div>
      </div>

      {/* Mobile: Giao den */}
      <a href="/contact.html" className="flex items-center gap-1 bg-az-footer-top px-3 py-2 text-[13px] md:hidden">
        <MapPin className="size-4" aria-hidden="true" /> Giao đến <strong>Toàn quốc</strong>
      </a>

      {/* Sub-nav */}
      <nav aria-label="Điều hướng" className="bg-az-nav">
        <ul className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-2 py-1 text-sm whitespace-nowrap">
          <li className="hidden md:block">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="flex items-center gap-1 rounded-sm border border-transparent px-2 py-1 font-bold hover:border-white"
              aria-haspopup="dialog"
            >
              <Menu className="size-5" aria-hidden="true" /> Tất cả
            </button>
          </li>
          {[HOME_LINK, ...categories.flatMap((c) => [c, ...(c.children ?? [])]).map((c) => ({ label: c.name, href: c.href })), ...INFO_LINKS].map((l) => (
            <li key={l.href}>
              <a href={l.href} className="block rounded-sm border border-transparent px-2.5 py-1 font-medium hover:border-white/70">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Drawer open={drawer} onClose={() => setDrawer(false)} customer={customer} firstName={firstName} categories={categories} />
    </header>
  );
}

function Logo({ shopName }: { shopName: string }) {
  return (
    <a href="/" className="shrink-0 rounded-sm border border-transparent px-1.5 py-1 hover:border-white/70" aria-label={`${shopName} - trang chủ`}>
      {/* Logo dang chu: chu cai dau + ten shop (xem brand.tsx) */}
      <BrandLogo name={shopName} tone="light" tagline />
    </a>
  );
}

function SearchForm({ categories, search, shopName, compact = false }: Pick<HeaderProps, "categories" | "search" | "shopName"> & { compact?: boolean }) {
  const id = compact ? "search-m" : "search-d";
  const all = categories.flatMap((c) => [c, ...(c.children ?? [])]);
  const selected = all.find((c) => c.id === search.catalogueId);
  const [label, setLabel] = useState(selected?.name ?? "Tất cả");
  return (
    <form action="/products.html" method="get" role="search" className="flex h-10 overflow-hidden rounded-md bg-white focus-within:ring-3 focus-within:ring-az-search">
      {!compact && (
        <div className="relative flex shrink-0 items-center border-r border-[#cdcdcd] bg-[#e6e6e6] text-xs text-[#555] hover:bg-[#d4d4d4]">
          <span className="pointer-events-none flex items-center gap-1 px-2" aria-hidden="true">
            {label} <ChevronDown className="size-3" />
          </span>
          <label htmlFor={`${id}-cat`} className="sr-only">
            Tìm trong
          </label>
          <select
            id={`${id}-cat`}
            name="product_catalogue_id"
            defaultValue={search.catalogueId ? String(search.catalogueId) : ""}
            onChange={(e) => setLabel(e.target.selectedOptions[0]?.text ?? "Tất cả")}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => [
              <option key={c.id} value={c.id}>
                {c.name}
              </option>,
              ...(c.children ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {"  "}
                  {k.name}
                </option>
              )),
            ])}
          </select>
        </div>
      )}
      <label htmlFor={`${id}-q`} className="sr-only">
        Tìm trong {shopName}
      </label>
      <input
        id={`${id}-q`}
        type="search"
        name="keyword"
        defaultValue={search.keyword}
        placeholder={`Tìm trong ${shopName}`}
        className="min-w-0 flex-1 px-3 text-[15px] text-az-text outline-none"
      />
      <button type="submit" className="flex w-12 shrink-0 items-center justify-center bg-az-search text-az-text hover:bg-az-search-hover" aria-label="Tìm">
        <Search className="size-5" aria-hidden="true" />
      </button>
    </form>
  );
}

function AccountMenu({ customer, firstName }: { customer: HeaderProps["customer"]; firstName: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    timer.current = window.setTimeout(() => setOpen(false), 150);
  };
  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <a
        href={customer ? "/account.html" : "/login.html"}
        className="flex shrink-0 items-center gap-1 rounded-sm border border-transparent px-2 py-1 leading-tight hover:border-white"
      >
        <UserRound className="size-6 md:hidden" aria-hidden="true" />
        <span className="text-xs md:hidden">{customer ? firstName : "Đăng nhập ›"}</span>
        <span className="hidden md:block">
          <span className="block text-xs text-white/70">Xin chào, {customer ? firstName : "đăng nhập"}</span>
          <span className="flex items-center text-sm font-bold">
            Tài khoản <ChevronDown className="size-3" aria-hidden="true" />
          </span>
        </span>
      </a>
      {open && (
        <div className="absolute top-full right-0 z-50 hidden w-64 rounded-sm bg-white p-4 text-az-text shadow-xl md:block">
          {!customer ? (
            <div className="mb-3 border-b border-az-border pb-3 text-center">
              <a href="/login.html" className="az-btn az-btn-cart w-full rounded-lg">
                Đăng nhập
              </a>
              <p className="mt-2 text-xs">
                Khách mới?{" "}
                <a href="/register.html" className="az-link">
                  Đăng ký tại đây.
                </a>
              </p>
            </div>
          ) : null}
          <p className="mb-1 font-bold">Tài khoản</p>
          <ul className="space-y-1 text-[13px]">
            <li>
              <a href="/account.html" className="hover:text-az-link-hover hover:underline">
                Thông tin tài khoản
              </a>
            </li>
            <li>
              <a href="/account/password.html" className="hover:text-az-link-hover hover:underline">
                Đăng nhập &amp; bảo mật
              </a>
            </li>
            {customer && (
              <li>
                <form action="/logout.html" method="post">
                  <button type="submit" className="hover:text-az-link-hover hover:underline">
                    Đăng xuất
                  </button>
                </form>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Drawer({
  open,
  onClose,
  customer,
  firstName,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  customer: HeaderProps["customer"];
  firstName: string;
  categories: HeaderProps["categories"];
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  if (!open) return null;
  const item = "block px-8 py-3 text-sm text-az-text hover:bg-az-bg";
  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Menu chính">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-[365px] flex-col overflow-y-auto bg-white text-az-text">
        <a href={customer ? "/account.html" : "/login.html"} className="flex items-center gap-2 bg-az-nav px-8 py-3 text-lg font-bold text-white">
          <UserRound className="size-6" aria-hidden="true" /> Xin chào, {customer ? firstName : "đăng nhập"}
        </a>
        <p className="px-8 pt-4 pb-2 text-lg font-bold">Danh mục sản phẩm</p>
        <ul>
          <li>
            <a href="/products.html" className={item}>
              Tất cả sản phẩm
            </a>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <a href={c.href} className={item}>
                {c.name}
              </a>
              {!!c.children?.length && (
                <ul>
                  {c.children.map((k) => (
                    <li key={k.id}>
                      <a href={k.href} className={`${item} pl-12 text-[15px]`}>
                        {k.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <hr className="my-2 border-az-border" />
        <ul>
          {[HOME_LINK, ...INFO_LINKS].map((l) => (
            <li key={l.href}>
              <a href={l.href} className={item}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <hr className="my-2 border-az-border" />
        <p className="px-8 pt-2 pb-2 text-lg font-bold">Trợ giúp &amp; Cài đặt</p>
        <ul className="pb-6">
          <li>
            <a href="/account.html" className={item}>
              Tài khoản
            </a>
          </li>
          <li>
            <a href="/contact.html" className={item}>
              Chăm sóc khách hàng
            </a>
          </li>
          <li>
            {customer ? (
              <form action="/logout.html" method="post">
                <button type="submit" className={`${item} w-full text-left`}>
                  Đăng xuất
                </button>
              </form>
            ) : (
              <a href="/login.html" className={item}>
                Đăng nhập
              </a>
            )}
          </li>
        </ul>
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Đóng menu"
        className="absolute top-3 left-[min(calc(85%+8px),373px)] text-white"
      >
        <X className="size-8" aria-hidden="true" />
      </button>
    </div>
  );
}
