
import React from 'react';

export const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`w-6 h-6 animate-spin ${className}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v3m0 12v3m9-9h-3m-12 0H3m16.5-6.5l-2.12 2.12M6.62 17.38l-2.12 2.12m12.72 0l-2.12-2.12M6.62 6.62l-2.12-2.12"
    />
  </svg>
);
