import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // rounded-full doesn't resolve through the zeroed radius token (it's a hard
  // 9999px), so Etapa 2 maps it by hand: --radius-xs (2px) is the one
  // documented small-badge exception in DESIGN.md ({rounded.xs}).
  "inline-flex items-center justify-center rounded-xs border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground [a&]:hover:bg-accent",
        yellow:
          "bg-primary text-primary-foreground uppercase text-[11px] font-semibold tracking-[0.09em] [a&]:hover:bg-primary-active",
        secondary:
          "bg-secondary text-secondary-foreground border-border [a&]:hover:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground [a&]:hover:bg-destructive-active focus-visible:ring-destructive/20",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
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
