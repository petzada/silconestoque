import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // rounded-full doesn't resolve through the zeroed radius token (it's a hard
  // 9999px), so Etapa 2 maps it by hand: --radius-xs (2px) is the one
  // documented small-badge exception in DESIGN.md ({rounded.xs}).
  // E.2/V4: this is a rewrite, not a re-tokenization — Carbon Tag on a light
  // theme is a pale fill + dark text of the same color family, never a solid
  // fill with near-black text. uppercase/tracking removed per DESIGN.md (no
  // all-caps tracked eyebrows/tags).
  "inline-flex items-center justify-center rounded-xs border border-transparent px-2 py-0.5 text-xs font-normal w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] aria-invalid:shadow-[inset_0_0_0_2px_var(--destructive)] transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // Gray Tag: bg-muted (surface-1, #f4f4f4) + ink text — already a
        // valid Carbon-pale pair, high contrast (see report for measured
        // ratio).
        default: "bg-muted text-foreground [a&]:hover:bg-accent",
        // Kept as a name so existing call sites keep resolving (none found
        // today, checked via grep). Renders the info/blue pale pair — the
        // closest Carbon Tag to the old solid-brand badge.
        yellow: "bg-info-muted text-info [a&]:hover:bg-info-muted",
        // Darker gray Tag: surface-2 (#e0e0e0) + ink text, distinguishable
        // from the default gray tag.
        secondary: "bg-surface-elevated text-foreground [a&]:hover:bg-accent",
        // Red Tag: red-10 fill + red-70 text. red-70 (not red-60/--destructive)
        // because red-60 on red-10 falls short of the 4.5:1 body-text
        // minimum — see report.
        destructive:
          "bg-danger-muted text-destructive-active [a&]:hover:bg-danger-muted",
        outline: "border-border text-foreground [a&]:hover:bg-accent",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
