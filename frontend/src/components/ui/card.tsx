import { cn } from './cn';
import { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border-brutal bg-white text-black p-4 shadow-brutal-sm', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';
