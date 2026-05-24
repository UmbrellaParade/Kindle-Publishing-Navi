import React, { useMemo } from 'react';

export default function RainEffect() {
  const drops = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 1.5 + Math.random() * 2,
      opacity: 0.1 + Math.random() * 0.3,
      width: 1 + Math.random(),
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="rain-drop absolute"
          style={{
            left: `${drop.left}%`,
            animationDelay: `${drop.delay}s`,
            animationDuration: `${drop.duration}s`,
            opacity: drop.opacity,
            width: `${drop.width}px`,
            height: '80px',
            background: `linear-gradient(to bottom, transparent, hsl(185 80% 50% / 0.4), transparent)`,
          }}
        />
      ))}
    </div>
  );
}