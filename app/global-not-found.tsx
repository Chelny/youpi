import { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { clsx } from "clsx/lite";
import Anchor from "@/components/ui/Anchor";
import { ROUTE_HOME } from "@/constants/routes";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Not Found",
  description: "It looks like the page you’re looking for doesn’t exist or has been moved.",
};

export default async function GlobalNotFound(): Promise<ReactNode> {
  return (
    <html lang="en" dir="ltr">
      <body className={inter.className}>
        <div className="relative overflow-hidden flex flex-col items-center justify-center w-full h-screen p-2 sm:p-0 bg-youpi-primary">
          <div
            className={clsx(
              "flex flex-col items-center justify-center gap-2 w-full sm:w-96 rounded shadow-xl bg-gray-200",
              "dark:bg-dark-card-background",
            )}
          >
            <div className={clsx("w-full h-8 rounded-t bg-gray-300", "dark:bg-dark-background")} />
            <div className="flex flex-col gap-6 w-full px-4 pb-4">
              <div>
                <h1 className="text-lg">Page Not Found</h1>
                <p>It looks like the page you’re looking for doesn’t exist or has been moved.</p>
              </div>
              <div className="self-end">
                <Anchor href={ROUTE_HOME.PATH}>Go to homepage</Anchor>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
