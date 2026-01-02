"use client";

import { ReactNode } from "react";
import Image from "next/image";
import { APP_CONFIG } from "@/constants/app";

type HeaderProps = {
  children?: ReactNode
};

export function Header({ children }: HeaderProps): ReactNode {
  return (
    <header className="flex justify-between items-center gap-4 px-4 py-2 bg-youpi-primary text-white">
      <div className="flex gap-2">
        <Image src="/favicon.svg" width={36} height={24} alt={APP_CONFIG.NAME} />
        <h1 className="text-white text-4xl font-black uppercase text-shadow-md text-shadow-black">{APP_CONFIG.NAME}</h1>
      </div>
      {children}
    </header>
  );
}
