import React from 'react';

export const FingerprintIcon: React.FC<{ className?: string }> = ({ className }) => (
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
        <path d="M12 12h.01"/>
        <path d="M16.5 9.4a5 5 0 1 0-9.9 1.2"/>
        <path d="M18.4 11.2a9 9 0 1 0-12.8 2.6"/>
        <path d="M20.2 14.5a13 13 0 0 0-16.4 4.3"/>
    </svg>
);
