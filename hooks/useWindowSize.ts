"use client";

import { useEffect, useState } from "react";

export function useWindowSize() {
  const [size, setSize] = useState<Record<string, number>>({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = (): void => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}
