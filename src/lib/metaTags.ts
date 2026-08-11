/**
 * Dynamic Meta Tags for Social Sharing
 * Updates meta tags for OG, Twitter, etc. when content changes
 */

export interface MetaTagsConfig {
    title: string;
    description: string;
    image?: string;
    url?: string;
    type?: "website" | "article";
    twitterCard?: "summary" | "summary_large_image";
}

export const updateMetaTags = (config: MetaTagsConfig) => {
    const {
        title,
        description,
        image,
        url = window.location.href,
        type = "website",
        twitterCard = "summary_large_image",
    } = config;

    // Update basic meta tags
    updateMetaTag("description", description);
    updateMetaTag("og:title", title);
    updateMetaTag("og:description", description);
    updateMetaTag("og:type", type);
    updateMetaTag("og:url", url);

    // Update page title
    document.title = title;

    // Update OG image if provided
    if (image) {
        updateMetaTag("og:image", image);
        updateMetaTag("og:image:width", "1200");
        updateMetaTag("og:image:height", "630");
        updateMetaTag("twitter:image", image);
    }

    // Update Twitter card
    updateMetaTag("twitter:card", twitterCard);
    updateMetaTag("twitter:title", title);
    updateMetaTag("twitter:description", description);

    // Update canonical URL
    updateCanonicalUrl(url);
};

export const updateMetaTag = (name: string, content: string) => {
    let element = document.querySelector(
        `meta[name="${name}"], meta[property="${name}"]`
    ) as HTMLMetaElement;

    if (!element) {
        element = document.createElement("meta");
        element.setAttribute(name.startsWith("og:") ? "property" : "name", name);
        document.head.appendChild(element);
    }

    element.content = content;
};

export const updateCanonicalUrl = (url: string) => {
    let link = document.querySelector("link[rel='canonical']") as HTMLLinkElement;

    if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
    }

    link.href = url;
};

/**
 * Auto-update meta tags when navigating
 * Use in useEffect for page-specific meta tags
 */
export const useMetaTags = (config: MetaTagsConfig) => {
    React.useEffect(() => {
        updateMetaTags(config);
    }, [config]);
};

// Default meta tags initialization
export const initializeDefaultMetaTags = () => {
    const defaultConfig: MetaTagsConfig = {
        title: "itsusmoment - Your Love Story in One Place",
        description:
            "Celebrate your love. Share moments, memories, and milestones with your partner. A beautiful space for couples to connect and cherish their journey together.",
        image: `${window.location.origin}/og-image.png`,
        url: window.location.origin,
    };

    updateMetaTags(defaultConfig);
};

import React from "react";
