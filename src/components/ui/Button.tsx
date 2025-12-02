'use client';

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        size === "md" && "px-4 py-2 text-sm font-semibold",
        size === "sm" && "px-3 py-1.5 text-xs font-semibold",
        variant === "primary" &&
          "bg-primary text-white shadow-soft hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-primary",
        variant === "ghost" &&
          "text-text hover:bg-blue-50 focus-visible:outline-primary",
        variant === "outline" &&
          "border border-border bg-white text-text hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-primary",
        props.disabled && "pointer-events-none opacity-60",
        className
      )}
      {...props}
    >
      {icon}
      {loading ? "Loading..." : children}
    </button>
  );
}
