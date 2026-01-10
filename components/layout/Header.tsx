"use client";

import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { APP_CONFIG } from "@/constants/app";
import { ROUTE_HOME } from "@/constants/routes";

type HeaderProps = {
  children?: ReactNode
};

export function Header({ children }: HeaderProps): ReactNode {
  return (
    <header className="flex justify-between items-center gap-4 px-4 py-1 bg-youpi-primary text-white">
      <Link href={ROUTE_HOME.PATH} className="flex items-center gap-2">
        <Image src="/favicon.svg" width={32} height={20} alt={APP_CONFIG.NAME} />
        <h1 className="text-white text-4xl font-black uppercase tracking-tight text-shadow-md text-shadow-black">
          {APP_CONFIG.NAME}
        </h1>
      </Link>
      {children}
    </header>
  );
}
