"use client";

import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Naming a team preset, in the game's own look (Tanveer's pick, 2026-09-26,
 * "In-game name dialog").
 *
 * It replaced `window.prompt` and `window.alert`: the browser's own dialogs,
 * which cannot take the motif, carry no 44px floor, and on some phones render
 * as a system sheet that has nothing to do with the game. The same dialog
 * serves saving and renaming; the caller says which, and decides what a
 * submitted name does.
 *
 * `onSubmit` returns an error message to show in place, or `null` on
 * success, which closes the dialog. That is how "you already have eight
 * presets" is said now: inside the dialog, beside the field, rather than in
 * an alert box after it.
 */
export default function PresetNameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => string | null;
  /** From `useReturnFocus`: the button that opened this is not a
   *  `DialogTrigger`, so focus is handed back by the caller. */
  onCloseAutoFocus?: (event: Event) => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {/* Keyed on the name it opens with, so each opening starts from that
            name rather than from whatever the last one left typed. */}
        {open ? (
          <NameForm
            key={initialName}
            title={title}
            description={description}
            initialName={initialName}
            submitLabel={submitLabel}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
  onCancel,
  onDone,
}: {
  title: string;
  description?: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => string | null;
  onCancel: () => void;
  onDone: () => void;
}): React.JSX.Element {
  const [name, setName] = React.useState(initialName);
  const [error, setError] = React.useState<string | null>(null);
  const trimmed = name.trim();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed) return;
        const problem = onSubmit(trimmed);
        if (problem) setError(problem);
        else onDone();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? (
          <DialogDescription>{description}</DialogDescription>
        ) : null}
      </DialogHeader>
      <div className="grid gap-1.5">
        <label
          htmlFor="preset-name"
          className="font-body text-label font-bold uppercase tracking-label text-muted-foreground"
        >
          Preset name
        </label>
        <Input
          id="preset-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          // No `autoFocus`: radix moves focus into the dialog on open, and
          // the field is its first focusable element.
          autoComplete="off"
          aria-invalid={error !== null || undefined}
        />
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
