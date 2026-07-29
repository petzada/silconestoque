"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        // Carbon label-01: 12px/400, letter-spacing 0.32px (DESIGN.md
        // {typography.caption}, exact match in @carbon/type's label01).
        // Was 14px/500 — this shrinks every FormItem; see report for which
        // fixed-height dialogs need a visual re-check (risk E.15).
        "flex items-center gap-2 text-xs leading-none font-normal tracking-[0.32px] select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
