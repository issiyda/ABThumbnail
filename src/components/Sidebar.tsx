'use client';

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

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-border bg-card/80 px-5 py-8 shadow-sm lg:flex">
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
    </aside>
  );
}
