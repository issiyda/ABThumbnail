'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  Library,
  MonitorPlay,
  PanelsTopLeft,
  PanelTop,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import clsx from "clsx";

const nav: Array<{ href: string; label: string; icon: typeof Sparkles }> = [
  { href: "/", label: "サムネ生成", icon: Sparkles },
  { href: "/templates", label: "型カタログ", icon: Library },
  { href: "/lp", label: "LP作成", icon: FileText },
  { href: "/slides", label: "スライド生成", icon: MonitorPlay },
  { href: "/manga", label: "マンガ作成", icon: PanelTop },
  { href: "/limitless", label: "Limitless要約", icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const NavContent = () => (
    <>
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
          <PanelsTopLeft />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            NanoBanana
          </p>
          <p className="text-lg font-bold text-text">Thumbnail Studio</p>
        </div>
      </div>

      <nav className="space-y-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href as any}
              onClick={closeMobileMenu}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
                active
                  ? "bg-primary text-white shadow-soft"
                  : "text-text hover:bg-blue-50"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-4 text-xs text-muted">
        <p className="font-semibold text-text">ローカル完結</p>
        <p>APIキーや画像はブラウザ内にのみ保存され、サーバーに送信されません。</p>
      </div>
    </>
  );

  return (
    <>
      {/* モバイル用ハンバーガーボタン */}
      <button
        onClick={toggleMobileMenu}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-lg lg:hidden"
        aria-label="メニューを開く"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* PC用サイドバー */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-border bg-card/80 px-5 py-8 shadow-sm lg:flex">
        <NavContent />
      </aside>

      {/* モバイル用サイドバー */}
      <aside
        className={clsx(
          "fixed left-0 top-0 z-40 h-screen w-64 flex-shrink-0 flex-col border-r border-border bg-card/95 px-5 py-8 shadow-lg transition-transform duration-300 lg:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
