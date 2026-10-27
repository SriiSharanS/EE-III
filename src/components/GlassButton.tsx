import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type GlassButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type GlassButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

export function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function GlassButton({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  children,
  type = 'button',
  disabled,
  ...props
}: GlassButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`glass-button glass-button--${variant} glass-button--${size} ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="glass-button-content">
        <span className="glass-button-label">{children}</span>
        {loading ? (
          <span className="glass-button-spinner" aria-label="Loading" aria-hidden="true" />
        ) : icon ? (
          <span className="glass-button-icon">{icon}</span>
        ) : null}
      </span>
    </button>
  );
}
