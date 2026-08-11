/**
 * Debounce Utility
 * Delays function execution until after specified wait time has elapsed
 * Useful for search, resize, scroll handlers
 */

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle Utility
 * Ensures function runs at most once per specified wait time
 * Useful for scroll, mousemove handlers
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    let previous = 0;

    return function executedFunction(...args: Parameters<T>) {
        const now = Date.now();
        const remaining = wait - (now - previous);

        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            func(...args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                previous = Date.now();
                timeout = null;
                func(...args);
            }, remaining);
        }
    };
}

/**
 * React Hook for Debounced Value
 * Returns debounced state value
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
}

/**
 * React Hook for Throttled Callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
    callback: T,
    wait: number
): (...args: Parameters<T>) => void {
    const throttledRef = React.useRef<any>(null);

    React.useEffect(() => {
        throttledRef.current = throttle(callback, wait);
    }, [callback, wait]);

    return (...args: Parameters<T>) => {
        if (throttledRef.current) {
            throttledRef.current(...args);
        }
    };
}

import React from "react";
