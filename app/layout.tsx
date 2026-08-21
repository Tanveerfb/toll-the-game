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
  // `cover` lets the page paint under a notch and the home indicator, which is
  // what `100dvh` is already measuring. Without it a full-height screen gets
  // letterboxed by the safe area and `dvh` quietly stops meaning the screen.
  // The cost is that anything pinned to an edge must pad itself — `.pb-safe`
  // in styles/globals.css is that padding.
  viewportFit: "cover",
};

import BattleProvider from "@/hooks/BattleProvider";
import MechanicProvider from "@/hooks/MechanicProvider";
import { AuthProvider } from "@/hooks/AuthProvider";
import { cn } from "@/lib/utils";
import TopNav from "@/components/ui/TopNav";
import MotionProvider from "@/components/providers/MotionProvider";
import ServiceWorkerRegistration from "@/components/providers/ServiceWorkerRegistration";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
        {/* `TooltipProvider` used to wrap all of this. Every tooltip in the
            game became a `Hint` on 2026-08-21 (ruling #120) and nothing has
            imported the primitive since, so the provider was rendering for
            no one. */}
        <AuthProvider>
          <MechanicProvider>
            <BattleProvider>
              <MotionProvider>
                <TopNav />
                {children}
              </MotionProvider>
            </BattleProvider>
          </MechanicProvider>
        </AuthProvider>
        {/* Both no-op off Vercel, so local dev and any other host are
            unaffected. Page views and Core Web Vitals from real phones —
            which is the only way to find out whether the mobile pass actually
            worked on hardware nobody here owns. */}
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
