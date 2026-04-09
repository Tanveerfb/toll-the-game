import type { Metadata } from "next";
import { Bangers, Rajdhani } from "next/font/google";
import "../styles/globals.scss";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bangers.variable} ${rajdhani.variable}`}>
      <body>{children}</body>
    </html>
  );
}
