import React, { type HTMLAttributes, type ReactNode } from 'react';
import { useSciFiSounds } from '../../hooks/useSciFiSounds';

interface CyberCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  innerClassName?: string;
  innerStyle?: React.CSSProperties;
}

export const CyberCard: React.FC<CyberCardProps> = ({ 
  children, 
  className = '', 
  style,
  innerClassName = '',
  innerStyle,
  onMouseEnter,
  ...props 
}) => {
  const { playHover } = useSciFiSounds();

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    playHover();
    if (onMouseEnter) onMouseEnter(e);
  };

  return (
    <div 
      className={`cyber-card-container ${className}`} 
      style={style} 
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      <div className="cyber-card-border">
        <div 
          className={`cyber-card-inner ${innerClassName}`} 
          style={innerStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
