import { ReactNode } from "react";
import { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import UserMenu from "@/components/layout/UserMenu";
import ScreenSizeGuard from "@/components/ScreenSizeGuard";
import Sidebar from "@/components/sidebar/Sidebar";
import ThemeToggleButton from "@/components/ThemeToggleButton";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

type ProtectedLayoutProps = LayoutProps<"/[locale]">;

export default function ProtectedLayout({ children }: ProtectedLayoutProps): ReactNode {
  return (
    <div className="grid grid-rows-[max-content_1fr_max-content] h-dvh">
      <Header>
        <div className="flex gap-2">
          <ThemeToggleButton />
          <UserMenu />
        </div>
      </Header>
      <main className="flex min-h-0">
        <Sidebar />
        <ScreenSizeGuard>{children}</ScreenSizeGuard>
      </main>
      <Footer />
    </div>
  );
}
