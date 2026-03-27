"use client";

import { ReactNode } from "react";

export type HudPosition =
  | "topRight"
  | "topCenter"
  | "bottomLeft"
  | "bottomRight"
  | "bottomCenter"
  | "inline";

interface MapHudShellProps {
  title: string;
  subtitle?: string;
  position?: HudPosition;
  dense?: boolean;
  children: ReactNode;
}

const POSITION_CLASS: Record<HudPosition, string> = {
  topRight: "top-4 right-4",
  topCenter: "top-4 left-1/2 -translate-x-1/2",
  bottomLeft: "bottom-4 left-4",
  bottomRight: "bottom-4 right-4",
  bottomCenter: "bottom-4 left-1/2 -translate-x-1/2",
  inline: "",
};

export default function MapHudShell({
  title,
  subtitle,
  position = "topRight",
  dense = false,
  children,
}: MapHudShellProps) {
  const isInline = position === "inline";
  return (
    <div
      className={
        isInline
          ? "pointer-events-none w-full"
          : `absolute z-[1000] ${POSITION_CLASS[position]} max-w-[min(92vw,22rem)] pointer-events-none`
      }
    >
      <section className="pointer-events-auto card-mono shadow-mono-lg">
        <header className={`border-b border-primary-200 ${dense ? "px-3 py-2" : "px-4 py-3"}`}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-900 text-wrap balance">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-[11px] text-primary-600 text-wrap pretty">{subtitle}</p>
          ) : null}
        </header>
        <div className={dense ? "px-3 py-2 text-xs" : "px-4 py-3 text-xs"}>{children}</div>
      </section>
    </div>
  );
}
