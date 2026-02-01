import * as React from "react"
import { cn } from "@/lib/utils"

interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description: string
  iconBg?: "primary" | "secondary" | "accent" | "success" | "warning" | "error"
  href?: string
  action?: React.ReactNode
}

const iconBgClasses = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  accent: "bg-accent/10 text-accent",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-600",
  error: "bg-red-100 text-red-600",
}

export const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ className, icon, title, description, iconBg = "primary", href, action, ...props }, ref) => {
    const content = (
      <div ref={ref} className={cn(
        "group relative px-6 py-8 rounded-xl border border-border/40 bg-card hover:shadow-xl hover:border-border transition-all duration-300 hover:-translate-y-1",
        href && "cursor-pointer",
        className
      )} {...props}>
        {icon && (
          <div className={cn("inline-flex p-3 rounded-lg mb-4 transition-transform group-hover:scale-110", iconBgClasses[iconBg])}>
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
        {action && (
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            {action}
          </div>
        )}
        {href && (
          <a href={href} className="absolute inset-0 rounded-xl" />
        )}
      </div>
    )

    return content
  }
)
FeatureCard.displayName = "FeatureCard"
