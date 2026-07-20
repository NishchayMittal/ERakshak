import React, { HTMLAttributes } from 'react';

interface CyberCardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  innerClassName?: string;
  innerStyle?: React.CSSProperties;
}

export const CyberCard: React.FC<CyberCardProps> = ({ 
  children, 
  className = '', 
  style,
  innerClassName = '',
  innerStyle,
  ...props 
}) => {
  return (
    <div 
      className={`cyber-card-container ${className}`} 
      style={style} 
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
