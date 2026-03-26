"use client";

import React from "react";
import { cn } from "@/utils/cn";

interface LayerToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}

/**
 * Visual row for toggling a layer on the Map sidebar.
 * Extracted so design tweaks live in one place.
 */
export default function LayerToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: LayerToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-lg cursor-pointer transition-colors border border-transparent px-3 py-2",
        "hover:bg-energy-50 hover:border-energy-200",
        checked && "bg-energy-100 border-energy-300"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 w-4 h-4 rounded border-energy-300 text-energy-600 focus:ring-energy-600"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-energy-900">{label}</div>
        {description && (
          <div className="text-xs text-energy-500 font-mono mt-0.5">
            {description}
          </div>
        )}
      </div>
    </label>
  );
}
