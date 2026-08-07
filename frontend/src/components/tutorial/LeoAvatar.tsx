import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

interface LeoAvatarProps {
  className?: string;
}

export function LeoAvatar({ className = '' }: LeoAvatarProps) {
  return (
    <div className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 border-[#39FF14] bg-black/80 shadow-[0_0_15px_rgba(57,255,20,0.5)] ${className}`}>
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 rounded-full bg-[#39FF14] opacity-20 blur-sm"
      />
      <Bot className="w-6 h-6 text-[#39FF14]" />
      <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#39FF14] rounded-full border border-black animate-pulse" />
    </div>
  );
}
