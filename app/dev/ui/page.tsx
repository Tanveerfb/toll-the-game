import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Hint from "@/components/ui/Hint";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Screen } from "@/components/ui/Screen";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const metadata: Metadata = { title: "UI kit (dev)" };

/**
 * Every Shōnen Ink primitive in every variant, on the dark ground and on
 * paper (ruling #154). **Development only**: production returns 404. His
 * pick, 2026-09-26, so the kit can be judged in one place before the screens
 * move over. Check it before and after touching a primitive.
 *
 * Only primitives already migrated are here (`tests/uiTokens.test.ts` lists
 * them). `Card`, `Panel` and `Table` move with their screens, so they join
 * this page when they do.
 */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const variants = [
    "default",
    "secondary",
    "outline",
    "ghost",
    "claim",
    "destructive",
    "link",
  ] as const;
  const sizes = ["xs", "sm", "default", "lg", "xl"] as const;
  const badges = [
    "default",
    "secondary",
    "outline",
    "ink",
    "destructive",
    "ghost",
  ] as const;

  return (
    <Screen width="app">
      <div className="flex flex-col gap-10 py-6">
        <header className="flex flex-col gap-2">
          <Badge variant="ink" className="self-start">
            Dev only
          </Badge>
          <h1 className="font-heading text-4xl tracking-title">
            Shōnen Ink kit
          </h1>
          <p className="max-w-prose text-sm text-ground-dim">
            Every migrated primitive, on the ground and on paper. Values and
            rules are in <code>docs/design-system.md</code>.
          </p>
        </header>

        <Section title="Type">
          <div className="flex flex-col gap-2">
            <p className="font-heading text-4xl tracking-title">
              Molvarr, Sunken Warden
            </p>
            <p className="text-base">
              Body 16: M PLUS 1p. Does damage equal to ATK-scaled to one enemy.
            </p>
            <p className="text-sm">Small 14: a dense panel&apos;s body.</p>
            <p className="text-xs">Extra small 12.</p>
            <p className="text-caption">Caption 11: secondary lines.</p>
            <p className="text-label font-bold uppercase tracking-label">
              Label 10: the floor
            </p>
            <p className="text-micro font-bold">
              Micro 9: hand cards and unit tiles only
            </p>
          </div>
        </Section>

        <Section title="Buttons on the ground">
          <div className="flex flex-wrap items-center gap-3">
            {variants.map((v) => (
              <Button key={v} variant={v}>
                {v}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {sizes.map((s) => (
              <Button key={s} size={s}>
                Size {s}
              </Button>
            ))}
            <Button size="icon" variant="outline" aria-label="Icon size">
              ✕
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Buttons on paper">
          <Paper>
            <div className="flex flex-wrap items-center gap-3">
              {variants.map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
            </div>
          </Paper>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-3">
            {badges.map((v) => (
              <Badge key={v} variant={v}>
                {v}
              </Badge>
            ))}
          </div>
          <Paper>
            <div className="flex flex-wrap items-center gap-3">
              {badges.map((v) => (
                <Badge key={v} variant={v}>
                  {v}
                </Badge>
              ))}
            </div>
          </Paper>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="team">
            <TabsList>
              <TabsTrigger value="brief">Brief</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>
            <TabsContent value="brief" className="text-sm text-ground-dim">
              Default variant, on the ground.
            </TabsContent>
            <TabsContent value="team" className="text-sm text-ground-dim">
              The active tab turns to paper with a yellow slab.
            </TabsContent>
            <TabsContent value="rewards" className="text-sm text-ground-dim">
              Every trigger is 44px tall.
            </TabsContent>
          </Tabs>
          <Paper>
            <Tabs defaultValue="skills">
              <TabsList variant="line">
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="passive">Passive</TabsTrigger>
                <TabsTrigger value="ultimate">Ultimate</TabsTrigger>
              </TabsList>
              <TabsContent value="skills">Line variant, inside paper.</TabsContent>
              <TabsContent value="passive">No slant where text is read.</TabsContent>
              <TabsContent value="ultimate">An ink underline marks it.</TabsContent>
            </Tabs>
          </Paper>
        </Section>

        <Section title="Toggle group">
          <ToggleGroup
            type="single"
            defaultValue="2"
            variant="outline"
            spacing={0}
            aria-label="Difficulty"
          >
            {["1", "2", "3", "4"].map((d) => (
              <ToggleGroupItem key={d} value={d}>
                D{d}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Paper>
            <ToggleGroup
              type="multiple"
              defaultValue={["red"]}
              variant="outline"
              size="sm"
              aria-label="Element"
            >
              {["light", "red", "blue", "green", "dark"].map((e) => (
                <ToggleGroupItem key={e} value={e}>
                  {e}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Paper>
        </Section>

        <Section title="Form controls">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="kit-auto-clear" className="text-sm font-bold">
                Auto clear
              </label>
              <Switch id="kit-auto-clear" defaultChecked />
            </div>
            <Input placeholder="Search characters" />
            <Slider defaultValue={[40]} max={100} aria-label="Volume" />
            <Progress value={62} />
          </div>
          <Paper>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="kit-skip-card" className="text-sm font-bold">
                  Skip victory card
                </label>
                <Switch id="kit-skip-card" />
              </div>
              <Input placeholder="On paper" />
              <Slider defaultValue={[70]} max={100} aria-label="Music" />
              <Progress value={30} />
            </div>
          </Paper>
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Forfeit the fight?</DialogTitle>
                  <DialogDescription>
                    The stamina for this attempt is already spent.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Keep fighting</Button>
                  </DialogClose>
                  <Button variant="destructive">Forfeit</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    A bottom sheet: the default side, in the thumb third.
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4">
                  <ToggleGroup type="multiple" variant="outline" size="sm">
                    {["light", "red", "blue", "green", "dark"].map((e) => (
                      <ToggleGroupItem key={e} value={e}>
                        {e}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </SheetContent>
            </Sheet>
            <p className="text-sm">
              A{" "}
              <Hint
                content="Ignores the target's DEF."
                className="cursor-help underline decoration-dotted underline-offset-4"
              >
                weakpoint
              </Hint>{" "}
              hint: tap it.
            </p>
          </div>
        </Section>

        <Section title="Treatments">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex h-32 items-center justify-center border-2 border-ground-line speed-lines">
              <span className="font-heading text-2xl tracking-title">
                Speed lines
              </span>
            </div>
            <div className="flex h-32 items-center justify-center border-2 border-border bg-card text-card-foreground ink-slab">
              <span className="font-heading text-2xl tracking-title">
                Paper, slab
              </span>
            </div>
          </div>
        </Section>
      </div>
    </Screen>
  );
}

/** A gallery section: an ink-lettered header on the ground. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="self-start bg-card px-3 pt-1 font-heading text-2xl tracking-title text-card-foreground ink-skew ink-slab-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A plain paper panel, so each primitive can be seen on both grounds. */
function Paper({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-border bg-card p-4 text-card-foreground ink-slab">
      {children}
    </div>
  );
}
