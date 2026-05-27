import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { SUPPORTED_LOCALES } from '../../i18n';
import type { LocaleConfig } from '../../i18n';

export interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons' | 'flags' | 'select';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
  dropdownClassName?: string;
  onLocaleChange?: (locale: string) => void;
  excludedLocales?: string[];
  includeLocales?: string[];
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  size = 'md',
  showLabel = true,
  showFlag = true,
  showNativeName = false,
  className = '',
  dropdownClassName = '',
  onLocaleChange,
  excludedLocales = [],
  includeLocales,
}) => {
  const { locale, changeLocale, isRTL, supportedLocales } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredLocales = supportedLocales.filter((loc) => {
    if (excludedLocales.includes(loc.code)) return false;
    if (includeLocales && !includeLocales.includes(loc.code)) return false;
    return true;
  });

  const currentLocale = SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES.find(l => l.code === 'en')!;

  const handleLocaleSelect = useCallback(
    async (localeCode: string) => {
      await changeLocale(localeCode);
      onLocaleChange?.(localeCode);
      setIsOpen(false);
    },
    [changeLocale, onLocaleChange]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs py-1 px-2';
      case 'lg':
        return 'text-base py-2 px-4';
      default:
        return 'text-sm py-1.5 px-3';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  };

  if (variant === 'flags') {
    return (
      <div
        className={`flex items-center gap-1 ${className}`}
        role="radiogroup"
        aria-label="Select language"
      >
        {filteredLocales.map((loc) => (
          <button
            key={loc.code}
            onClick={() => handleLocaleSelect(loc.code)}
            className={`
              ${getSizeClasses()}
              flex items-center justify-center
              rounded-md border transition-colors
              ${
                locale === loc.code
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }
            `}
            aria-checked={locale === loc.code}
            role="radio"
            title={loc.name}
          >
            <span className={getIconSize()}>{loc.flag}</span>
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'buttons') {
    return (
      <div
        className={`flex items-center gap-1 flex-wrap ${className}`}
        role="radiogroup"
        aria-label="Select language"
      >
        {filteredLocales.map((loc) => (
          <button
            key={loc.code}
            onClick={() => handleLocaleSelect(loc.code)}
            className={`
              ${getSizeClasses()}
              flex items-center gap-1.5
              rounded-md border transition-colors
              ${
                locale === loc.code
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }
            `}
            aria-checked={locale === loc.code}
            role="radio"
          >
            {showFlag && <span className={getIconSize()}>{loc.flag}</span>}
            {showLabel && (
              <span>
                {showNativeName ? loc.nativeName : loc.name}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'select') {
    return (
      <select
        value={locale}
        onChange={(e) => handleLocaleSelect(e.target.value)}
        className={`
          ${getSizeClasses()}
          ${getIconSize()}
          appearance-none
          bg-white border border-gray-300 rounded-md
          pl-3 pr-8 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300
          ${className}
        `}
        style={{
          backgroundImage: isRTL
            ? `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`
            : `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: isRTL ? 'left 0.5rem center' : 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
        }}
        aria-label="Select language"
      >
        {filteredLocales.map((loc) => (
          <option key={loc.code} value={loc.code}>
            {showFlag ? `${loc.flag} ` : ''}
            {showNativeName ? loc.nativeName : loc.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${getSizeClasses()}
          flex items-center gap-2
          bg-white border border-gray-300 rounded-md
          hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700
          transition-colors
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {showFlag && <span className={getIconSize()}>{currentLocale.flag}</span>}
        {showLabel && (
          <span className="font-medium">
            {showNativeName ? currentLocale.nativeName : currentLocale.name}
          </span>
        )}
        <svg
          className={`${getIconSize()} transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 min-w-[200px]
            bg-white border border-gray-200 rounded-lg shadow-lg
            dark:bg-gray-800 dark:border-gray-700
            ${dropdownClassName}
            ${isRTL ? 'left-0' : 'right-0'}
          `}
          role="listbox"
          aria-label="Language options"
        >
          <div className="py-1">
            {filteredLocales.map((loc) => (
              <button
                key={loc.code}
                onClick={() => handleLocaleSelect(loc.code)}
                className={`
                  w-full text-left
                  ${getSizeClasses()}
                  flex items-center gap-2
                  ${locale === loc.code
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }
                  transition-colors
                  ${isRTL ? 'flex-row-reverse text-right' : ''}
                `}
                role="option"
                aria-selected={locale === loc.code}
              >
                <span className={getIconSize()}>{loc.flag}</span>
                <span className="flex-1">
                  {showNativeName ? loc.nativeName : loc.name}
                </span>
                {locale === loc.code && (
                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export interface LanguageSwitcherStandaloneProps {
  currentLocale: string;
  onLocaleChange: (locale: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LanguageSwitcherStandalone: React.FC<LanguageSwitcherStandaloneProps> = ({
  currentLocale,
  onLocaleChange,
  size = 'md',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const locales = SUPPORTED_LOCALES;
  const currentLocaleConfig = SUPPORTED_LOCALES.find(l => l.code === currentLocale) || SUPPORTED_LOCALES.find(l => l.code === 'en')!;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs py-1 px-2';
      case 'lg':
        return 'text-base py-2 px-4';
      default:
        return 'text-sm py-1.5 px-3';
    }
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${getSizeClasses()}
          flex items-center gap-2
          bg-white border border-gray-300 rounded-md
          hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500
          dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700
          transition-colors
        `}
      >
        <span className="w-5 h-5">{currentLocaleConfig.flag}</span>
        <span className="font-medium">{currentLocaleConfig.nativeName}</span>
        <svg
          className="w-4 h-4 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[180px] right-0 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700">
          <div className="py-1">
            {locales.map((loc) => (
              <button
                key={loc.code}
                onClick={() => {
                  onLocaleChange(loc.code);
                  setIsOpen(false);
                }}
                className={`
                  w-full text-left ${getSizeClasses()} flex items-center gap-2
                  ${currentLocale === loc.code
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }
                `}
              >
                <span className="w-5 h-5">{loc.flag}</span>
                <span>{loc.nativeName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
