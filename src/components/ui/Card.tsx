'use client';

import clsx from "clsx";
import type { HTMLAttributes } from "react";

export default function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "glass rounded-2xl border border-border/80 bg-card p-4 shadow-[0_10px_40px_rgba(49,129,252,0.08)]",
        className
      )}
      {...props}
    />
  );
}
