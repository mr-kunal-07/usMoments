import {
    addYears,
    differenceInDays,
    differenceInMonths,
    differenceInYears,
    isAfter,
    startOfDay,
    setYear,
} from "date-fns";

// ─── Constants ─────────────────────────────────────────────────────────────────

export const RING_MAX_DAYS = 365;

/** Days away at which we switch from duration display to countdown display. */
export const COUNTDOWN_THRESHOLD_DAYS = 30;

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MilestoneType = "anniversary" | "milestone";

export interface MediaItem {
    id: string;
    file_path: string;
    title: string;
    file_type: string;
}

export type MediaMap = Record<string, MediaItem>;

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the next upcoming occurrence of a recurring anniversary date.
 * Uses date-fns setYear to handle Feb-29 edge cases correctly.
 */
export function getNextOccurrence(dateStr: string): Date {
    const now = startOfDay(new Date());
    const original = new Date(dateStr);

    // Build this year's occurrence safely (handles Feb 29 → Feb 28 on non-leap years)
    let next = setYear(original, now.getFullYear());

    // If today is already past this occurrence, advance to next year
    if (!isAfter(next, now)) {
        next = addYears(next, 1);
    }

    return next;
}

/**
 * Days until the next recurring occurrence of a date string.
 * Returns 0 if the anniversary is today.
 */
export function daysUntil(dateStr: string): number {
    return differenceInDays(getNextOccurrence(dateStr), startOfDay(new Date()));
}

/**
 * Calculates completed years between the original date and a reference date.
 * Correctly handles "before the anniversary in the current year" cases.
 * Uses date-fns differenceInYears for accuracy.
 */
export function completedYears(dateStr: string, referenceDate: Date = new Date()): number {
    const original = new Date(dateStr);
    return differenceInYears(referenceDate, original);
}

/**
 * Human-readable duration from a past date until now.
 * Examples: "2 years", "2y 3mo", "8 months", "23 days"
 */
export function durationLabel(dateStr: string): string {
    const now = new Date();
    const original = new Date(dateStr);
    const years = differenceInYears(now, original);
    const months = differenceInMonths(now, original) % 12;
    const days = differenceInDays(now, original);

    if (years > 0 && months > 0) return `${years}y ${months}mo`;
    if (years > 0) return `${years} year${years !== 1 ? "s" : ""}`;
    if (months > 0) return `${months} month${months !== 1 ? "s" : ""}`;
    return `${days} day${days !== 1 ? "s" : ""}`;
}

/**
 * Returns all "this year" occurrences of an anniversary date for a given
 * year/month, expanding ±1 year to fill month boundaries correctly.
 * Uses setYear (not manual getFullYear arithmetic) to handle leap years.
 */
export function anniversaryOccurrencesInMonth(
    dateStr: string,
    year: number,
    month: number // 0-indexed
): Date[] {
    const result: Date[] = [];

    for (const offset of [-1, 0, 1]) {
        const occurrence = setYear(new Date(dateStr), year + offset);
        if (occurrence.getMonth() === month) {
            result.push(occurrence);
        }
    }

    return result;
}