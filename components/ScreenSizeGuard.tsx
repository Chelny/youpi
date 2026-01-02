"use client";

import { ReactNode } from "react";
import { useWindowSize } from "@/hooks/useWindowSize";

type ScreenSizeGuardProps = {
  children: ReactNode
};

export default function ScreenSizeGuard({ children }: ScreenSizeGuardProps): ReactNode {
  const { width, height } = useWindowSize();
  const isSmallScreen: boolean = width < 1275 || height < 768;

  return (
    <div className="flex-1 min-h-0 overflow-x-hidden" style={{ overflowY: isSmallScreen ? "hidden" : "auto" }}>
      {children}
    </div>
  );
}
