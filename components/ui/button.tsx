import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Carbon focus: inset 2px ring via box-shadow, never border/outline width —
  // a border swap would grow the box and shift h-8 icon buttons by 2px (E.4).
  // Carbon button label type is 14px/400 (DESIGN.md {typography.button}); the
  // old font-semibold (600) is dropped.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-normal transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] aria-invalid:shadow-[inset_0_0_0_2px_var(--destructive)]",
  {
    variants: {
      variant: {
        // button-primary (DESIGN.md): solid IBM Blue, pressed state blue-80.
        default: "bg-primary text-primary-foreground hover:bg-primary-active",
        // button-danger (DESIGN.md): solid red-60, hover to red-70.
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-active",
        // button-tertiary (DESIGN.md): canvas + 1px blue border + blue text;
        // hover fills solid with the pressed-blue step (blue-hover has no
        // shipped token per DESIGN.md's flagged discrepancy, so blue-80 is
        // reused rather than inventing a hex).
        outline:
          "border border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground",
        // button-secondary (DESIGN.md): solid charcoal/ink, inverse text.
        // Carbon's hover-secondary token isn't in the installed packages
        // either; --muted-foreground (gray-70, #525252) is the closest
        // already-resolved token and reads as a lighter-charcoal hover.
        secondary:
          "bg-foreground text-background hover:bg-muted-foreground",
        // button-ghost (DESIGN.md): no fill until hover, text is always blue.
        // Hover text switches blue-60 -> blue-70 (--info, same hex Carbon
        // calls "linkPrimaryHover" per DESIGN.md's flagged discrepancy):
        // blue-60 text on the --accent hover fill measures ~4.08:1, below
        // the 4.5:1 AA floor (V6 already requires this swap off pure white).
        ghost:
          "text-primary hover:bg-accent hover:text-info",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Carbon component scale is 32 / 40 / 48 only (DESIGN.md spacing +
        // component sizing). h-6/size-9 were off-scale; every step below now
        // lands on 32, 40, or 48. None of xs/lg/icon-xs/icon-lg have call
        // sites today (checked before changing), so this is a safe fix.
        default: "h-10 px-4 py-3 has-[>svg]:px-4",
        xs: "h-8 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
