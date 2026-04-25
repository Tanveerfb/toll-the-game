import type { Metadata } from "next";
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
  title: "Toll the Game",
  description: "A card battle game",
};

import BattleProvider from "@/hooks/BattleProvider";
import MechanicProvider from "@/hooks/MechanicProvider";
import { AuthProvider } from "@/hooks/AuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bangers.variable} ${rajdhani.variable}`}>
      <body>
        <AuthProvider>
          <MechanicProvider>
            <BattleProvider>{children}</BattleProvider>
          </MechanicProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
