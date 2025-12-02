'use client';

import clsx from "clsx";
import type { LabelHTMLAttributes } from "react";

export default function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx("block text-sm font-semibold text-text/80", className)}
      {...props}
    />
  );
}
