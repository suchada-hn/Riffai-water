import { cn } from './cn';
import { HTMLAttributes, ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Size = 'sm' | 'md' | 'lg';

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-2 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
};

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-black text-white border-brutal shadow-brutal-sm hover:invert-hover active:shadow-none',
  secondary:
    'bg-white text-black border-brutal hover:invert-hover active:shadow-none',
  ghost:
    'bg-transparent text-black border-transparent hover:bg-black hover:text-white active:bg-black active:text-white',
  destructive:
    'bg-red text-white border-brutal-red shadow-brutal-sm hover:bg-white hover:text-red active:shadow-none',
};

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, HTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-mono font-medium uppercase tracking-[0.12em] transition-colors duration-80 border select-none disabled:opacity-30 disabled:pointer-events-none',
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
