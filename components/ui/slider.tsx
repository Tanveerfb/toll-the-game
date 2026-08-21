"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Combat Terminal defaults (ruling #84): the game has no rounded geometry, so
// the track and thumb are squared off here rather than at every usage. The
// colour tokens are already remapped globally, so only the shape and the
// hardcoded white thumb needed changing.

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        // The root is what radix listens on, so it — not the 4px track — is
        // the band a thumb can land in. `min-h-11` gives the whole control a
        // 44px grab area while the track stays a hairline.
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-horizontal:min-h-11 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-none bg-inset data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-signal select-none data-horizontal:h-full data-vertical:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          // The thumb reads as a 12px marker and *hits* as a 44px one: the
          // `after` pseudo-element is the touch target, invisible and centred
          // on the thumb. It was `-inset-2` (28px effective) — enough for a
          // mouse, not for a thumb on a phone (ruling #107). Keeping the two
          // sizes separate is the point; a 44px visible block would swamp a
          // 4px track.
          className="relative block size-3 shrink-0 rounded-none border border-signal bg-signal ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-4 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
