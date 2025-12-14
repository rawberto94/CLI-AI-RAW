/**
 * Confetti Component
 * Animated confetti celebration effect
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiPiece {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocity: { x: number; y: number };
}

export interface ConfettiProps {
  active?: boolean;
  duration?: number; // milliseconds
  particleCount?: number;
  colors?: string[];
  className?: string;
}

const defaultColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
];

export function Confetti({
  active = false,
  duration = 3000,
  particleCount = 50,
  colors = defaultColors,
  className = '',
}: ConfettiProps) {
  const [particles, setParticles] = useState<ConfettiPiece[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (active && !isActive) {
      setIsActive(true);
      createParticles();
      
      const timer = setTimeout(() => {
        setIsActive(false);
        setParticles([]);
      }, duration);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, duration, isActive]);

  const createParticles = () => {
    const newParticles: ConfettiPiece[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: `particle-${i}`,
        x: Math.random() * 100,
        y: -10,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#FF6B6B',
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        velocity: {
          x: (Math.random() - 0.5) * 4,
          y: Math.random() * 2 + 1,
        },
      });
    }
    
    setParticles(newParticles);
  };

  if (!isActive) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none z-50 overflow-hidden ${className}`}>
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute"
            style={{
              left: `${particle.x}%`,
              backgroundColor: particle.color,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
            }}
            initial={{
              y: -20,
              rotate: particle.rotation,
              opacity: 1,
            }}
            animate={{
              y: typeof window !== 'undefined' ? window.innerHeight + 20 : 1000,
              x: particle.velocity.x * 100,
              rotate: particle.rotation + 720,
              opacity: 0,
            }}
            transition={{
              duration: duration / 1000,
              ease: 'linear',
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0.2 },
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
