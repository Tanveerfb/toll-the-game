import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink text field (ruling #154): a paper field with an ink outline, so
 * it reads the same on the dark ground and on a paper panel.
 *
 * `h-11` because a field you tap to focus is a touch target like any other
 * (ruling #107), and 16px type is what stops iOS Safari zooming the page on
 * focus — which is why the base size stays `text-base` and only narrows at
 * `md`.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-none border-2 border-input bg-card px-2.5 py-1 font-body text-base text-card-foreground transition-[color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-card-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/40 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
