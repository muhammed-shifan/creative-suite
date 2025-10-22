import React from 'react';

export const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M9.8 5.9 3 12.7l-1.4-1.4L8.4 4.5l1.4 1.4Z" />
    <path d="m14.1 10.2 1.4-1.4-1.4-1.4-1.4 1.4 1.4 1.4Z" />
    <path d="M12.7 3 14 4.4l-1.4 1.4-1.4-1.4L12.7 3Z" />
    <path d="m19.6 8.4-1.4 1.4-1.4-1.4 1.4-1.4 1.4 1.4Z" />
    <path d="m21 12.7-1.4-1.4-1.4 1.4 1.4 1.4 1.4-1.4Z" />
    <path d="M12.7 21 14 19.6l-1.4-1.4-1.4 1.4L12.7 21Z" />
    <path d="m4.5 15.5 1.4-1.4-1.4-1.4-1.4 1.4 1.4 1.4Z" />
    <path d="m10.2 14.1 1.4-1.4-1.4-1.4-1.4 1.4 1.4 1.4Z" />
    <path d="M11.3 22.7 18.1 16l-1.4-1.4-6.8 6.8 1.4 1.4Z" />
  </svg>
);
