import * as React from "react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-primary-foreground)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  destructive: {
    backgroundColor: "var(--color-destructive)",
    color: "var(--color-destructive-foreground)",
  },
  outline: {
    border: "1px solid var(--color-input)",
    backgroundColor: "var(--color-background)",
    color: "var(--color-foreground)",
  },
  secondary: {
    backgroundColor: "var(--color-secondary)",
    color: "var(--color-secondary-foreground)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--color-foreground)",
  },
  link: {
    backgroundColor: "transparent",
    color: "var(--color-primary)",
    textDecoration: "underline",
  },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  default: { height: "36px", padding: "8px 16px" },
  sm: { height: "32px", padding: "6px 12px", fontSize: "12px" },
  lg: { height: "40px", padding: "8px 32px" },
  icon: { height: "36px", width: "36px", padding: "0" },
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          borderRadius: "var(--radius-md)",
          fontSize: "14px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s ease",
          border: "none",
          gap: "6px",
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...(props.disabled ? { opacity: 0.5, pointerEvents: "none" as const } : {}),
          ...style,
        }}
        className={className}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
