import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useSciFiSounds } from '../../hooks/useSciFiSounds';

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
}

export const CyberButton: React.FC<CyberButtonProps> = ({ 
  children, 
  icon,
  className = '', 
  containerClassName = '',
  containerStyle,
  onMouseEnter,
  onClick,
  ...props 
}) => {
  const { playHover, playClick } = useSciFiSounds();

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    playHover();
    if (onMouseEnter) onMouseEnter(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    playClick();
    if (onClick) onClick(e);
  };

  return (
    <div 
      className={`cyber-button-container ${containerClassName} ${props.disabled ? 'opacity-50 pointer-events-none' : ''}`} 
      style={containerStyle}
    >
      <button 
        className={`cyber-button ${className}`} 
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        {...props}
      >
        {children}
        {icon && icon}
      </button>
    </div>
  );
};
