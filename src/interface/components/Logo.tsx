import React from 'react';

interface LogoProps {
  variant?: 'full' | 'mark';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ variant = 'full', className = '' }) => {
  if (variant === 'mark') {
    return (
      <img
        src="/images/live-agents-mark.svg"
        alt="Live Agents"
        className={`w-8 h-8 ${className}`}
      />
    );
  }

  return (
    <img
      src="/images/live-agents.svg"
      alt="Live Agents"
      className={`h-7 w-auto ${className}`}
    />
  );
};

export default Logo;
