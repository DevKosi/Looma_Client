import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { FiSun, FiMoon, FiEye, FiEyeOff, FiZap, FiZapOff } from 'react-icons/fi';

export default function ThemeToggle() {
  const { isDark, isHighContrast, isReducedMotion, toggleTheme, toggleHighContrast, toggleReducedMotion } = useTheme();

  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-soft border border-gray-200 dark:border-gray-700">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <FiSun className="w-5 h-5 text-yellow-500" />
        ) : (
          <FiMoon className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {/* High Contrast Toggle */}
      <button
        onClick={toggleHighContrast}
        className={`p-2 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          isHighContrast 
            ? 'bg-accent1-100 dark:bg-accent1-900/30 text-accent1-700 dark:text-accent1-300' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
        aria-label={isHighContrast ? 'Disable high contrast' : 'Enable high contrast'}
        title={isHighContrast ? 'Disable high contrast' : 'Enable high contrast'}
      >
        {isHighContrast ? (
          <FiEye className="w-5 h-5" />
        ) : (
          <FiEyeOff className="w-5 h-5" />
        )}
      </button>

      {/* Reduced Motion Toggle */}
      <button
        onClick={toggleReducedMotion}
        className={`p-2 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          isReducedMotion 
            ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
        aria-label={isReducedMotion ? 'Enable animations' : 'Reduce motion'}
        title={isReducedMotion ? 'Enable animations' : 'Reduce motion'}
      >
        {isReducedMotion ? (
          <FiZapOff className="w-5 h-5" />
        ) : (
          <FiZap className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}