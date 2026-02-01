import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  showLabel?: boolean
  variant?: "default" | "success" | "warning" | "error"
  size?: "sm" | "md" | "lg"
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, showLabel = false, variant = "default", size = "md", ...props }, ref) => {
    const percentage = Math.min((value / max) * 100, 100)

    const variantClasses = {
      default: "bg-gradient-to-r from-primary to-secondary",
      success: "bg-gradient-to-r from-emerald-400 to-emerald-600",
      warning: "bg-gradient-to-r from-amber-400 to-amber-600",
      error: "bg-gradient-to-r from-red-400 to-red-600",
    }

    const sizeClasses = {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
    }

    return (
      <div
        ref={ref}
        className={cn("w-full overflow-hidden rounded-full bg-muted", sizeClasses[size], className)}
        {...props}
      >
        <div
          className={cn("h-full transition-all duration-500 ease-out rounded-full", variantClasses[variant])}
          style={{ width: `${percentage}%` }}
        />
        {showLabel && (
          <div className="text-xs font-medium text-muted-foreground text-center mt-1">
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
