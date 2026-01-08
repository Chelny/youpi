"use client";

import { ReactNode } from "react";
import { MIN_GAME_VIEWPORT_HEIGHT, MIN_GAME_VIEWPORT_WIDTH } from "@/constants/game";
import { useWindowSize } from "@/hooks/useWindowSize";

type ScreenSizeGuardProps = {
  children: ReactNode
};

export default function ScreenSizeGuard({ children }: ScreenSizeGuardProps): ReactNode {
  const { width, height } = useWindowSize();
  const isSmallScreen: boolean = width < MIN_GAME_VIEWPORT_WIDTH || height < MIN_GAME_VIEWPORT_HEIGHT;

  return (
    <div className="flex-1 min-h-0 overflow-x-hidden" style={{ overflowY: isSmallScreen ? "hidden" : "auto" }}>
      {children}
    </div>
  );
}
