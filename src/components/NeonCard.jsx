import React from 'react';
import { cn } from '@/lib/utils';

export default function NeonCard({ children, className, glowColor = 'pink' }) {
  const glowClasses = {
    pink: 'neon-box-pink border-neon-pink/20',
    cyan: 'neon-box-cyan border-neon-cyan/20',
    amber: 'neon-box-amber border-neon-amber/20',
  };

  return (
    <div className={cn(
      'bg-card border rounded-lg p-4 md:p-6 transition-all duration-300',
      glowClasses[glowColor] || glowClasses.pink,
      className
    )}>
      {children}
    </div>
  );
}