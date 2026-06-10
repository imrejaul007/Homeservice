import { useEffect } from 'react';

export interface PageMetaProps {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: string;
  locale?: string;
}

const DEFAULT_IMAGE = '/og-default.png';
const SITE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://nilin.com';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

export const PageMeta: React.FC<PageMetaProps> = ({
  title,
  description,
  url,
  image = DEFAULT_IMAGE,
  type = 'website',
  locale = 'en',
}) => {
  useEffect(() => {
    const pageUrl = url || (typeof window !== 'undefined' ? window.location.href : SITE_URL);
    const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', pageUrl);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:locale', locale);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
  }, [title, description, url, image, type, locale]);

  return null;
};

export default PageMeta;
