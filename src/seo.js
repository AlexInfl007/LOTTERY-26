const DEFAULT_IMAGE_PATH = "/images/logo.png";

const ensureMetaTag = (selector, attributes) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
};

const ensureLinkTag = (selector, attributes) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
};

const ensureJsonLdScript = () => {
  let script = document.head.querySelector('script[data-seo="structured-data"]');

  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seo = "structured-data";
    document.head.appendChild(script);
  }

  return script;
};

export const updateSeo = ({ title, description, path = "/" }) => {
  const origin = window.location.origin;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const canonicalUrl = normalizedPath === "/" ? origin : `${origin}${normalizedPath}`;
  const imageUrl = `${origin}${DEFAULT_IMAGE_PATH}`;

  document.title = title;

  ensureMetaTag('meta[name="description"]', { name: "description", content: description });
  ensureMetaTag('meta[name="robots"]', { name: "robots", content: "index, follow, max-image-preview:large" });
  ensureMetaTag('meta[name="theme-color"]', { name: "theme-color", content: "#0f172a" });

  ensureMetaTag('meta[property="og:type"]', { property: "og:type", content: "website" });
  ensureMetaTag('meta[property="og:site_name"]', { property: "og:site_name", content: "Seren Lottery Chain" });
  ensureMetaTag('meta[property="og:title"]', { property: "og:title", content: title });
  ensureMetaTag('meta[property="og:description"]', { property: "og:description", content: description });
  ensureMetaTag('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  ensureMetaTag('meta[property="og:image"]', { property: "og:image", content: imageUrl });

  ensureMetaTag('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  ensureMetaTag('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  ensureMetaTag('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  ensureMetaTag('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });

  ensureLinkTag('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Seren Lottery Chain',
        url: origin,
        description,
        inLanguage: document.documentElement.lang || 'en',
      },
      {
        '@type': 'WebPage',
        name: title,
        url: canonicalUrl,
        description,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Seren Lottery Chain',
          url: origin,
        },
      },
      {
        '@type': 'Organization',
        name: 'Seren',
        url: origin,
        logo: imageUrl,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Seren Lottery Chain',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        description,
        url: origin,
      },
    ],
  };

  ensureJsonLdScript().textContent = JSON.stringify(structuredData);
};
