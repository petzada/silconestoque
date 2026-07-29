"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      // Carbon InlineNotification accent on toasts, mirroring alert.tsx
      // (Etapa 3): 3px semantic left border + pale tint fill per type.
      // sonner's own stylesheet sets background/border-color at
      // [data-sonner-toast][data-styled='true'], which out-specifies a plain
      // utility class — the `!` important modifier is load-bearing here, not
      // decorative, or the vendor rule silently wins the cascade.
      toastOptions={{
        classNames: {
          success:
            '!border-l-[3px] !border-l-success !bg-success-muted !text-success-active',
          error:
            '!border-l-[3px] !border-l-destructive !bg-danger-muted !text-destructive-active',
          warning: '!border-l-[3px] !border-l-warning !bg-warning-muted !text-warning',
          info: '!border-l-[3px] !border-l-info !bg-info-muted !text-info',
          // Alert.tsx keeps AlertDescription on --muted-foreground regardless
          // of variant; mirror that instead of inheriting the colored title.
          description: '!text-muted-foreground',
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
