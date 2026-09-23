"use client";

import { destinationCssVars, type DestinationTheme } from "@/lib/destination-themes";
import { cn } from "@/lib/utils";

/**
 * Wraps a trip experience and installs the destination palette as CSS custom
 * properties (including re-mapping the global --accent tokens), so every nested
 * card, link, chart and control inherits the destination identity.
 */
export function DestinationThemeScope({
  theme,
  className,
  children,
}: {
  theme: DestinationTheme;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={destinationCssVars(theme)} className={cn("dst-scope", className)}>
      {children}
    </div>
  );
}