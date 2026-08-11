/**
 * Centralised React Query key factory.
 * Always import keys from here — never hard-code string arrays in hooks.
 */

export const QK = {
  // Media
  media:           (folderId?: string | null, search?: string) => ["media", folderId, search] as const,
  mediaAll:        () => ["media"] as const,
  mediaInfinite:   () => ["media-infinite"] as const,
  mediaDeleted:    () => ["media", "recently-deleted"] as const,
  mediaStarred:    () => ["media", "starred"] as const,
  storageUsage:    () => ["storage-usage"] as const,

  // Profile
  profile:         (userId?: string) => ["profile", userId] as const,
  profilesAll:     () => ["profiles-all"] as const,

  // Couple
  myCouple:        () => ["my-couple"] as const,

  // Folders
  folders:         () => ["folders"] as const,

  // Messages
  messages:        (coupleId: string | null) => ["messages", coupleId] as const,

  // Love Notes & Reactions
  loveNotes:       (mediaId: string) => ["love_notes", mediaId] as const,
  reactions:       (mediaId: string) => ["reactions", mediaId] as const,

  // Tags
  tags:            () => ["tags"] as const,
  mediaTags:       (mediaId?: string | null) => ["media-tags", mediaId] as const,
  mediaTagsAll:    () => ["media-tags-all"] as const,

  // Notifications
  notifications:   () => ["notifications"] as const,

  // Milestones
  milestones:      () => ["milestones"] as const,

  // Memories
  memoriesTimeline:    () => ["memories-timeline"] as const,
  onThisDay:           () => ["on-this-day"] as const,
  relationshipStats:   () => ["relationship-stats"] as const,
  activityFeed:        () => ["activity-feed"] as const,

  // Subscription
  subscription:    (userId?: string) => ["subscription", userId] as const,
  effectivePlan:   (userId?: string) => ["effective-plan", userId] as const,
} as const;

/** Invalidate both media query variants (list + infinite) together */
export function invalidateMedia(qc: import("@tanstack/react-query").QueryClient) {
  qc.invalidateQueries({ queryKey: QK.mediaAll() });
  qc.invalidateQueries({ queryKey: QK.mediaInfinite() });
}
