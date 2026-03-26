"use client";

import { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface SidebarCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function SidebarCard({ title, children, className }: SidebarCardProps) {
  return (
    <div
      className={cn(
        "p-4 bg-energy-50 border border-energy-200 rounded-lg shadow-sm",
        className
      )}
    >
      {title && (
        <div className="text-xs font-semibold text-energy-900 uppercase tracking-wider mb-3">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
