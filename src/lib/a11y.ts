/**
 * Accessibility Utilities (a11y)
 * Helpers for improving WCAG 2.1 compliance
 */

/**
 * Generates unique ID for form elements
 */
export const generateId = (prefix: string): string => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Focus management
 */
export const focusElement = (element: HTMLElement | null) => {
    if (element) {
        element.focus();
        // Scroll into view if necessary
        element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
};

/**
 * Announce to screen readers
 */
export const announceToScreen = (message: string, type: "polite" | "assertive" = "polite") => {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", type);
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only"; // Visually hidden but readable by screen readers
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        announcement.remove();
    }, 3000);
};

/**
 * Skip navigation link (first focusable element for keyboard users)
 */
export const SkipLink: React.FC<{ href: string }> = ({ href }) => (
    <a
    href= { href }
className = "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
    >
    Skip to main content
        </a>
);

/**
 * Enhanced button with keyboard support
 */
export const enhanceButtonAccessibility = (element: HTMLButtonElement) => {
    if (!element) return;

    // Ensure button has accessible name
    if (!element.textContent && !element.getAttribute("aria-label")) {
        console.warn("Button missing accessible name");
    }

    // Handle Enter and Space key
    element.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            element.click();
        }
    });
};

/**
 * ARIA announcements for dynamic content
 */
export const announceAriaLive = (
    content: string,
    priority: "polite" | "assertive" = "polite"
) => {
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", priority);
    announcement.setAttribute("aria-atomic", "true");
    announcement.style.position = "absolute";
    announcement.style.left = "-10000px";
    announcement.style.width = "1px";
    announcement.style.height = "1px";
    announcement.style.overflow = "hidden";

    document.body.appendChild(announcement);
    announcement.textContent = content;

    setTimeout(() => announcement.remove(), 2000);
};

/**
 * Check if element is focusable
 */
export const isFocusable = (element: HTMLElement): boolean => {
    const focusableElements =
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";
    return element.matches(focusableElements);
};

/**
 * Get first focusable descendant
 */
export const getFirstFocusable = (container: HTMLElement): HTMLElement | null => {
    const focusableElements = container.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
    );
    return (focusableElements[0] as HTMLElement) || null;
};

/**
 * Trap focus within a container (useful for modals)
 */
export const useFocusTrap = (containerRef: React.RefObject<HTMLDivElement>) => {
    React.useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const focusableElements = container.querySelectorAll(
            "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
        );

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener("keydown", handleKeyDown);
        return () => container.removeEventListener("keydown", handleKeyDown);
    }, [containerRef]);
};

/**
 * Color contrast checker for accessibility
 */
export const getContrastRatio = (color1: string, color2: string): number => {
    const getLuminance = (color: string) => {
        const rgb = color.match(/\d+/g);
        if (!rgb || rgb.length < 3) return 0;

        const [r, g, b] = rgb.map((x) => {
            const c = parseInt(x) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
};

import React from "react";
