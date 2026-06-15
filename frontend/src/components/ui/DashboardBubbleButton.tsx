import React, { useRef } from 'react';
import { motion } from 'framer-motion';

interface DashboardBubbleButtonProps {
  onClick?: () => void;
  href?: string;
  className?: string;
  text?: string;
  variant?: string;
}

/**
 * NILIN-styled "Go to Dashboard" button with CSS-only blob effect.
 * Blob follows mouse cursor with a soft radial gradient.
 */
const DashboardBubbleButton: React.FC<DashboardBubbleButtonProps> = ({
  onClick,
  href,
  className = '',
  text = 'Go to Dashboard',
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = buttonRef.current;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    target.style.setProperty('--x', `${x}px`);
    target.style.setProperty('--y', `${y}px`);
    target.style.setProperty('--height', `${rect.height}px`);
    target.style.setProperty('--width', `${rect.width}px`);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (href) {
      window.location.href = href;
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className={`blob-container ${className}`}>
      <div
        ref={buttonRef}
        className="blob-inner group"
        onMouseMove={handleMouseMove}
      >
        <motion.button
          type="button"
          onClick={handleClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="blob-button relative z-10 flex items-center justify-center gap-3 px-8 py-4 rounded-full font-semibold text-base bg-gradient-to-br from-nilin-coral to-nilin-rose text-white shadow-xl shadow-nilin-coral/30 hover:shadow-2xl hover:shadow-nilin-coral/40 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:ring-offset-2"
        >
          {/* Dashboard Icon */}
          <svg
            className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-[-2px]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>

          {/* Text */}
          <span className="text-base">{text}</span>

          {/* Arrow */}
          <svg
            className="w-5 h-5 transition-all duration-300 group-hover:translate-x-1 opacity-80 group-hover:opacity-100"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </motion.button>

        {/* Blob Effect Layer */}
        <div className="blob" />
      </div>
    </div>
  );
};

export { DashboardBubbleButton };
export default DashboardBubbleButton;
