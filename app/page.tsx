import BattleTester from "@/components/game/BattleTester";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black min-h-screen p-8">
      <BattleTester />
    </div>
  );
}
