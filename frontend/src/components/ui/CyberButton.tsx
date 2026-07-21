import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';

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
  ...props 
}) => {
  return (
    <div 
      className={`cyber-button-container ${containerClassName}`} 
      style={containerStyle}
    >
      <button 
        className={`cyber-button ${className}`} 
        {...props}
      >
        {children}
        {icon && icon}
      </button>
    </div>
  );
};
