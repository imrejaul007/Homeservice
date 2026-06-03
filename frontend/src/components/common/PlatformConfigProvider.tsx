import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_CONFIG,
  fetchPlatformConfig,
  type PlatformPublicConfig,
} from '../../services/platformApi';

const PlatformConfigContext = createContext<PlatformPublicConfig>(DEFAULT_PLATFORM_CONFIG);

export function usePlatformConfig(): PlatformPublicConfig {
  return useContext(PlatformConfigContext);
}

function applyThemeToDocument(config: PlatformPublicConfig) {
  const root = document.documentElement;
  root.style.setProperty('--nilin-primary', config.primaryColor);
  root.style.setProperty('--nilin-secondary', config.secondaryColor);
  root.lang = config.language || 'en';

  if (config.favicon) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = config.favicon;
  }

  if (config.platformName) {
    document.title = config.platformName;
  }
}

export const PlatformConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<PlatformPublicConfig>(DEFAULT_PLATFORM_CONFIG);

  useEffect(() => {
    fetchPlatformConfig().then((loaded) => {
      setConfig(loaded);
      applyThemeToDocument(loaded);
    });
  }, []);

  return (
    <PlatformConfigContext.Provider value={config}>{children}</PlatformConfigContext.Provider>
  );
};
