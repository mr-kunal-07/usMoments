export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bucket_list: {
        Row: {
          added_by: string
          category: string | null
          completed_at: string | null
          completed_photo_url: string | null
          couple_id: string
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          note: string | null
          text: string
        }
        Insert: {
          added_by: string
          category?: string | null
          completed_at?: string | null
          completed_photo_url?: string | null
          couple_id: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          note?: string | null
          text: string
        }
        Update: {
          added_by?: string
          category?: string | null
          completed_at?: string | null
          completed_photo_url?: string | null
          couple_id?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          note?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_list_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      bucket_list_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_list_reactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "bucket_list"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          chat_theme_id: string
          created_at: string
          id: string
          invite_code: string
          status: string
          streak_count: number
          streak_longest: number
          streak_user1_sent: boolean
          streak_user2_sent: boolean
          streak_window_complete: boolean
          streak_window_start: string | null
          updated_at: string
          user1_id: string
          user2_id: string | null
        }
        Insert: {
          chat_theme_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          status?: string
          streak_count?: number
          streak_longest?: number
          streak_user1_sent?: boolean
          streak_user2_sent?: boolean
          streak_window_complete?: boolean
          streak_window_start?: string | null
          updated_at?: string
          user1_id: string
          user2_id?: string | null
        }
        Update: {
          chat_theme_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          status?: string
          streak_count?: number
          streak_longest?: number
          streak_user1_sent?: boolean
          streak_user2_sent?: boolean
          streak_window_complete?: boolean
          streak_window_start?: string | null
          updated_at?: string
          user1_id?: string
          user2_id?: string | null
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string
          created_by: string
          emoji: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          emoji?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          emoji?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      love_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          media_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          media_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          media_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "love_notes_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id: string | null
          id: string
          is_starred: boolean
          mime_type: string
          taken_at: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id?: string | null
          id?: string
          is_starred?: boolean
          mime_type: string
          taken_at?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          folder_id?: string | null
          id?: string
          is_starred?: boolean
          mime_type?: string
          taken_at?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      media_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          media_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          media_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_reactions_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_tags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          media_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          media_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          media_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_tags_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string
          couple_id: string
          created_at: string
          deleted_at: string | null
          id: string
          message_type: string
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          audio_url?: string | null
          content: string
          couple_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          audio_url?: string | null
          content?: string
          couple_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          media_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          description?: string | null
          id?: string
          media_id?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          media_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          media_id: string | null
          message: string
          read: boolean
          recipient_id: string
          type: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          media_id?: string | null
          message: string
          read?: boolean
          recipient_id: string
          type: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          media_id?: string | null
          message?: string
          read?: boolean
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_audit_log: {
        Row: {
          changed_at: string
          changed_by_user_id: string
          id: string
          new_plan: string
          note: string | null
          old_plan: string | null
          target_user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id: string
          id?: string
          new_plan: string
          note?: string | null
          old_plan?: string | null
          target_user_id: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string
          id?: string
          new_plan?: string
          note?: string | null
          old_plan?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      travel_locations: {
        Row: {
          city: string | null
          country: string | null
          couple_id: string
          created_at: string
          created_by: string
          date_visited: string | null
          description: string | null
          folder_id: string | null
          id: string
          latitude: number
          location_name: string
          longitude: number
          photo_urls: string[] | null
          tags: string[] | null
          updated_at: string
          visited: boolean
        }
        Insert: {
          city?: string | null
          country?: string | null
          couple_id: string
          created_at?: string
          created_by: string
          date_visited?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          latitude: number
          location_name: string
          longitude: number
          photo_urls?: string[] | null
          tags?: string[] | null
          updated_at?: string
          visited?: boolean
        }
        Update: {
          city?: string | null
          country?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string
          date_visited?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          latitude?: number
          location_name?: string
          longitude?: number
          photo_urls?: string[] | null
          tags?: string[] | null
          updated_at?: string
          visited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "travel_locations_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_locations_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_couple_invite: { Args: { _invite_code: string }; Returns: Json }
      check_couple_invite: { Args: { _invite_code: string }; Returns: Json }
      get_partner_id: { Args: { _user_id: string }; Returns: string }
      get_user_plan: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
