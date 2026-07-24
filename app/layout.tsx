import type { Metadata, Viewport } from "next";
import { Bangers, Rajdhani } from "next/font/google";
import "../styles/globals.css";

const bangers = Bangers({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const rajdhani = Rajdhani({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Toll The Game",
  description: "A card battle game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

import BattleProvider from "@/hooks/BattleProvider";
import MechanicProvider from "@/hooks/MechanicProvider";
import { AuthProvider } from "@/hooks/AuthProvider";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import TopNav from "@/components/ui/TopNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark font-sans", bangers.variable, rajdhani.variable)}
    >
      <body>
        <TooltipProvider>
          <AuthProvider>
            <MechanicProvider>
              <BattleProvider>
                <TopNav />
                {children}
              </BattleProvider>
            </MechanicProvider>
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
