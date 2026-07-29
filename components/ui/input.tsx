import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Carbon text-input signature (DESIGN.md): no border on the 4 sides —
        // surface-1 fill + a bottom hairline only. Padding 11px/16px per spec.
        // The focus/error states swap the hairline for a 2px underline; pb
        // shrinks by the same 1px the border grows so the box never reflows.
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full min-w-0 border-0 border-b border-border bg-muted px-4 pt-[11px] pb-[11px] text-base text-foreground transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-normal disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-b-2 focus-visible:border-primary focus-visible:pb-[10px]",
        "aria-invalid:border-b-2 aria-invalid:border-destructive aria-invalid:pb-[10px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
