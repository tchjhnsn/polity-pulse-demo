import * as React from "react";
import { cn } from "@/lib/utils";

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "ghost" | "outline" | "link" | "secondary";
    size?: "default" | "sm" | "icon";
  }
>(
  (
    { className, variant = "default", size = "default", ...props },
    ref,
  ) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const variants: Record<string, string> = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      ghost: "hover:bg-paper-2 text-ink-2",
      outline: "border border-rule-soft bg-card hover:bg-paper-2",
      link: "text-accent-blue underline-offset-4 hover:underline",
      secondary: "bg-secondary text-secondary-foreground hover:bg-paper-3",
    };
    const sizes: Record<string, string> = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      icon: "h-9 w-9",
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };