import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/getApiUrl';

type CaptchaProvider = 'hcaptcha' | 'recaptcha';

interface CaptchaConfig {
  enabled: boolean;
  provider: CaptchaProvider | null;
  siteKey: string | null;
}

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }
      ) => string;
      reset: (widgetId?: string) => void;
    };
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

interface CaptchaWidgetProps {
  onToken: (token: string | null) => void;
  className?: string;
}

let configPromise: Promise<CaptchaConfig> | null = null;

async function loadCaptchaConfig(): Promise<CaptchaConfig> {
  if (!configPromise) {
    configPromise = fetch(`${getApiUrl()}/auth/captcha-config`, { credentials: 'include' })
      .then((res) => res.json())
      .catch(() => ({ enabled: false, provider: null, siteKey: null }));
  }
  return configPromise;
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${id}`));
    document.head.appendChild(script);
  });
}

export const CaptchaWidget: React.FC<CaptchaWidgetProps> = ({ onToken, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | number | null>(null);
  const [config, setConfig] = useState<CaptchaConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetCaptcha = useCallback(() => {
    onToken(null);
    if (config?.provider === 'hcaptcha' && window.hcaptcha && widgetIdRef.current !== null) {
      window.hcaptcha.reset(widgetIdRef.current as string);
    }
    if (config?.provider === 'recaptcha' && window.grecaptcha && widgetIdRef.current !== null) {
      window.grecaptcha.reset(widgetIdRef.current as number);
    }
  }, [config?.provider, onToken]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const captchaConfig = await loadCaptchaConfig();
        if (cancelled) return;

        setConfig(captchaConfig);

        if (!captchaConfig.enabled || !captchaConfig.siteKey || !captchaConfig.provider) {
          onToken(null);
          return;
        }

        if (captchaConfig.provider === 'hcaptcha') {
          await loadScript('https://js.hcaptcha.com/1/api.js', 'hcaptcha-script');
        } else {
          await loadScript('https://www.google.com/recaptcha/api.js?render=explicit', 'recaptcha-script');
        }

        if (cancelled || !containerRef.current) return;

        const handleToken = (token: string) => onToken(token);
        const handleExpire = () => onToken(null);

        if (captchaConfig.provider === 'hcaptcha' && window.hcaptcha) {
          widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
            sitekey: captchaConfig.siteKey,
            callback: handleToken,
            'expired-callback': handleExpire,
          });
        } else if (window.grecaptcha) {
          window.grecaptcha.ready(() => {
            if (!containerRef.current) return;
            widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
              sitekey: captchaConfig.siteKey!,
              callback: handleToken,
              'expired-callback': handleExpire,
            });
          });
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load security verification. Please refresh and try again.');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [onToken]);

  if (config && !config.enabled) {
    return null;
  }

  return (
    <div className={className}>
      <div ref={containerRef} />
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      <button
        type="button"
        onClick={resetCaptcha}
        className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
      >
        Reset verification
      </button>
    </div>
  );
};

export default CaptchaWidget;
