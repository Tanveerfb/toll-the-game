import { notFound } from "next/navigation";
import KitLab from "@/components/kit-lab/KitLab";

// Dev-only kit-authoring tool. 404s in production — it writes to the working
// tree via /api/kit-lab (also prod-guarded).
export default function KitLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="min-h-[calc(100dvh-2.875rem)] bg-zinc-950">
      <KitLab />
    </main>
  );
}
