"use client";

import { ReactNode } from "react";
import clsx from "clsx/lite";
import Anchor from "@/components/ui/Anchor";
import { APP_CONFIG } from "@/constants/app";

export function Footer(): ReactNode {
  return (
    <footer className="flex justify-center items-center gap-1 px-4 py-2 bg-youpi-primary text-sm text-white">
      <span>© 2024</span> -{" "}
      <Anchor href={APP_CONFIG.GITHUB_REPO} className={clsx("text-white", "hover:text-white/50")}>
        {APP_CONFIG.NAME}
      </Anchor>
    </footer>
  );
}
