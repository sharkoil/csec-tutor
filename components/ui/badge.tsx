import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        accent:
          "border border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
        outline: "border border-border text-foreground hover:bg-muted",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
        warning:
          "border border-transparent bg-amber-100 text-amber-800 hover:bg-amber-200",
        info:
          "border border-transparent bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
