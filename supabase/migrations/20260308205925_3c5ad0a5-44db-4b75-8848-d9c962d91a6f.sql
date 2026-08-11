
-- ============================================================
-- SCALABILITY: Critical indexes for 100K user scale
-- ============================================================

-- Enable pg_trgm extension for fast ILIKE / fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- media table: most common query patterns
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON public.media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by_deleted_at ON public.media(uploaded_by, deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_folder_id ON public.media(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_is_starred ON public.media(is_starred, uploaded_by) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_media_taken_at ON public.media(taken_at) WHERE taken_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON public.media(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_created_at ON public.media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON public.media USING gin(title gin_trgm_ops);

-- messages table: high-frequency couple-scoped queries
CREATE INDEX IF NOT EXISTS idx_messages_couple_id_created_at ON public.messages(couple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(read_at) WHERE read_at IS NULL;

-- message_reactions: per-message lookups
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- notifications: per-recipient lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_id, read) WHERE read = false;

-- couples: fast lookup by either user
CREATE INDEX IF NOT EXISTS idx_couples_user1_id ON public.couples(user1_id);
CREATE INDEX IF NOT EXISTS idx_couples_user2_id ON public.couples(user2_id);
CREATE INDEX IF NOT EXISTS idx_couples_invite_code ON public.couples(invite_code) WHERE status = 'pending';

-- subscriptions: per-user lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);

-- profiles: per-user lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- user_roles: admin check is hot path
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- milestones
CREATE INDEX IF NOT EXISTS idx_milestones_created_by ON public.milestones(created_by);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON public.milestones(date DESC);

-- travel_locations: per-couple
CREATE INDEX IF NOT EXISTS idx_travel_locations_couple_id ON public.travel_locations(couple_id);

-- bucket_list: per-couple
CREATE INDEX IF NOT EXISTS idx_bucket_list_couple_id ON public.bucket_list(couple_id);

-- tags: per-user
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON public.tags(created_by);

-- media_tags
CREATE INDEX IF NOT EXISTS idx_media_tags_media_id ON public.media_tags(media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag_id ON public.media_tags(tag_id);

-- love_notes: per-media
CREATE INDEX IF NOT EXISTS idx_love_notes_media_id ON public.love_notes(media_id);

-- plan_audit_log
CREATE INDEX IF NOT EXISTS idx_plan_audit_log_target_user ON public.plan_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_audit_log_changed_at ON public.plan_audit_log(changed_at DESC);

-- folders: per-user and parent hierarchy
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON public.folders(created_by);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id) WHERE parent_id IS NOT NULL;
