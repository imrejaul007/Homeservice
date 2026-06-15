"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SparklesProps {
  className?: string;
  children?: React.ReactNode;
}

export function Sparkles({ className, children }: SparklesProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Sparkle particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-nilin-coral pointer-events-none"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            y: [0, -20],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: "easeInOut",
          }}
        />
      ))}
      {children}
    </div>
  );
}

interface CardSpotlightProps {
  children: React.ReactNode;
  className?: string;
}

export function CardSpotlight({ children, className }: CardSpotlightProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D2D2D] to-[#1a1a1a] border border-white/10",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Spotlight effect */}
      <motion.div
        className="absolute pointer-events-none"
        animate={{
          x: mousePosition.x - 150,
          y: mousePosition.y - 150,
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ duration: 0.1 }}
        style={{
          width: 300,
          height: 300,
          background:
            "radial-gradient(circle, rgba(232, 180, 168, 0.15) 0%, transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-3 gap-4 w-full",
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoItemProps {
  children: React.ReactNode;
  className?: string;
  span?: string;
}

export function BentoItem({ children, className, span = "" }: BentoItemProps) {
  return (
    <div
      className={cn(
        "glass-nilin rounded-2xl p-6",
        span === "col-span-2" && "md:col-span-2",
        span === "row-span-2" && "md:row-span-2",
        className
      )}
    >
      {children}
    </div>
  );
}

interface MovingBorderProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export function MovingBorder({ children, className, duration = 3000 }: MovingBorderProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div
        className="absolute inset-0 bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-blush animate-spin"
        style={{
          backgroundSize: "400% 400%",
          animation: `gradient-rotate ${duration}ms linear infinite`,
          padding: "2px",
        }}
      />
      <div className="absolute inset-[2px] rounded-2xl bg-[#2D2D2D]" />
      <div className="relative z-10">{children}</div>
      <style>{`
        @keyframes gradient-rotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

export function GlowingButton({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative px-8 py-4 rounded-full font-bold text-white overflow-hidden group",
        className
      )}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-nilin-coral to-nilin-rose"
        animate={{
          boxShadow: [
            "0 0 20px rgba(232, 180, 168, 0.4)",
            "0 0 40px rgba(232, 180, 168, 0.6)",
            "0 0 20px rgba(232, 180, 168, 0.4)",
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </div>
    </motion.button>
  );
}