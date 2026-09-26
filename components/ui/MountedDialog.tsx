"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFocusBackToOpener } from "@/hooks/useReturnFocus";

/**
 * The shadcn `Dialog`, for a modal its caller mounts only while it is open
 * (`{open ? <Thing onClose… /> : null}`), which is how most of the game's
 * modals are written.
 *
 * Five modals (Inventory, Account, Auto Clear, and the gacha's confirm, rates,
 * featured and milestone) each repeated the same wrapper: always open, a title
 * and a subtitle, close on dismiss, focus back to the opener. That is this
 * component, so the repetition and its one subtle part (focus return, which
 * radix cannot do without a `DialogTrigger`) live once.
 */
export default function MountedDialog({
  title,
  description,
  onClose,
  className,
  children,
}: {
  title: React.ReactNode;
  /** The small uppercase line under the title. */
  description?: React.ReactNode;
  onClose: () => void;
  /** Width, usually: `sm:max-w-lg` or `sm:max-w-2xl` for a wide one. */
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const onCloseAutoFocus = useFocusBackToOpener();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={className} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-caption font-bold uppercase tracking-eyebrow">
              {description}
            </DialogDescription>
          ) : (
            // Radix wants a description or an explicit opt-out; a dialog with
            // no subtitle says so rather than warning in the console.
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
