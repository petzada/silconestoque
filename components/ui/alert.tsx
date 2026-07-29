import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  // Carbon InlineNotification: 3px semantic left border + pale fill, never a
  // uniform 4-side border. No alpha compositing on the description text
  // (V10) — each variant sets a solid foreground color instead.
  "relative w-full border-l-[3px] px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-l-border bg-card text-card-foreground",
        // Text-on-tint uses the darker "-active" step that already exists as
        // a token (red-70/green-70), not the base semantic color: base
        // red-60/green-60 on their own -10 tint measures ~4.55:1, a
        // pass-but-thin margin over the 4.5:1 AA floor (see report). The
        // darker step clears ~7:1 at zero extra token cost.
        destructive:
          "border-l-destructive bg-danger-muted text-destructive-active",
        success: "border-l-success bg-success-muted text-success-active",
        // No darker "-active" step exists for warning (only --warning is
        // defined); text-warning on warning-muted measures ~4.56:1 — passes
        // AA but with the same thin margin as Carbon's own red/green-60
        // pairing formula. Flagged in the report rather than inventing a hex.
        warning: "border-l-warning bg-warning-muted text-warning",
        info: "border-l-info bg-info-muted text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
