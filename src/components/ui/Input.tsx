'use client';

import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export default function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
        className
      )}
      {...props}
    />
  );
}
