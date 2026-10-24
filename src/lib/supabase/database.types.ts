export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          coin_reward: number;
          description: string;
          icon: string;
          id: string;
          reward_item_id: string | null;
          scope: string;
          title: string;
          title_vi: string;
        };
        ComputedFields: never;
        Insert: {
          coin_reward?: number;
          description: string;
          icon: string;
          id: string;
          reward_item_id?: string | null;
          scope: string;
          title: string;
          title_vi: string;
        };
        Update: {
          coin_reward?: number;
          description?: string;
          icon?: string;
          id?: string;
          reward_item_id?: string | null;
          scope?: string;
          title?: string;
          title_vi?: string;
        };
        Relationships: [];
      };
      activity_days: {
        Row: {
          created_at: string;
          day: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      couple_activity_days: {
        Row: {
          couple_id: string;
          day: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          day: string;
          user_id: string;
        };
        Update: {
          couple_id?: string;
          day?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_activity_days_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_adventure_progress: {
        Row: {
          adventure_id: string;
          completed_at: string | null;
          couple_id: string;
          parts: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          adventure_id: string;
          completed_at?: string | null;
          couple_id: string;
          parts?: NonNullable<Json>;
        };
        Update: {
          adventure_id?: string;
          completed_at?: string | null;
          couple_id?: string;
          parts?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "couple_adventure_progress_adventure_id_fkey";
            columns: ["adventure_id"];
            isOneToOne: false;
            referencedRelation: "couple_adventures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "couple_adventure_progress_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_adventures: {
        Row: {
          couple_xp: number;
          id: string;
          letter: string;
          letter_vi: string;
          love_energy: number;
          parts: NonNullable<Json>;
          reward_item_id: string | null;
          sort_order: number;
          story: string;
          story_vi: string;
          title: string;
          title_vi: string;
        };
        ComputedFields: never;
        Insert: {
          couple_xp: number;
          id: string;
          letter: string;
          letter_vi: string;
          love_energy: number;
          parts: NonNullable<Json>;
          reward_item_id?: string | null;
          sort_order: number;
          story: string;
          story_vi: string;
          title: string;
          title_vi: string;
        };
        Update: {
          couple_xp?: number;
          id?: string;
          letter?: string;
          letter_vi?: string;
          love_energy?: number;
          parts?: NonNullable<Json>;
          reward_item_id?: string | null;
          sort_order?: number;
          story?: string;
          story_vi?: string;
          title?: string;
          title_vi?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_adventures_reward_item_id_fkey";
            columns: ["reward_item_id"];
            isOneToOne: false;
            referencedRelation: "shop_items";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_interactions: {
        Row: {
          couple_id: string;
          created_at: string;
          from_user: string;
          id: string;
          kind: string;
          responded_at: string | null;
          status: string;
          to_user: string;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          created_at?: string;
          from_user: string;
          id?: string;
          kind: string;
          responded_at?: string | null;
          status: string;
          to_user: string;
        };
        Update: {
          couple_id?: string;
          created_at?: string;
          from_user?: string;
          id?: string;
          kind?: string;
          responded_at?: string | null;
          status?: string;
          to_user?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_interactions_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_invitations: {
        Row: {
          code: string;
          couple_id: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          used_at: string | null;
          used_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          couple_id: string;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          couple_id?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "couple_invitations_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_members: {
        Row: {
          couple_id: string;
          joined_at: string;
          slot: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          joined_at?: string;
          slot: number;
          user_id: string;
        };
        Update: {
          couple_id?: string;
          joined_at?: string;
          slot?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_members_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_progress: {
        Row: {
          couple_id: string;
          home_level: number;
          level: number;
          love_energy: number;
          updated_at: string;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          home_level?: number;
          level?: number;
          love_energy?: number;
          updated_at?: string;
          xp?: number;
        };
        Update: {
          couple_id?: string;
          home_level?: number;
          level?: number;
          love_energy?: number;
          updated_at?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "couple_progress_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: true;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_public_profiles: {
        Row: {
          couple_id: string;
          is_public: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          is_public?: boolean;
          updated_at?: string;
        };
        Update: {
          couple_id?: string;
          is_public?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_public_profiles_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: true;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_quest_progress: {
        Row: {
          completed_at: string | null;
          couple_id: string;
          member_progress: NonNullable<Json>;
          quest_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          couple_id: string;
          member_progress?: NonNullable<Json>;
          quest_id: string;
          week_start: string;
        };
        Update: {
          completed_at?: string | null;
          couple_id?: string;
          member_progress?: NonNullable<Json>;
          quest_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_quest_progress_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "couple_quest_progress_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "couple_quests";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_quests: {
        Row: {
          coin_reward: number;
          couple_xp: number;
          description: string;
          event: string;
          id: string;
          love_energy: number;
          mode: string;
          target: number;
          title: string;
          title_vi: string;
        };
        ComputedFields: never;
        Insert: {
          coin_reward: number;
          couple_xp: number;
          description: string;
          event: string;
          id: string;
          love_energy: number;
          mode: string;
          target: number;
          title: string;
          title_vi: string;
        };
        Update: {
          coin_reward?: number;
          couple_xp?: number;
          description?: string;
          event?: string;
          id?: string;
          love_energy?: number;
          mode?: string;
          target?: number;
          title?: string;
          title_vi?: string;
        };
        Relationships: [];
      };
      couple_rank_tiers: {
        Row: {
          best_weekly_rank: number | null;
          couple_id: string;
          legend_points: number;
          tier: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          best_weekly_rank?: number | null;
          couple_id: string;
          legend_points?: number;
          tier?: number;
          updated_at?: string;
        };
        Update: {
          best_weekly_rank?: number | null;
          couple_id?: string;
          legend_points?: number;
          tier?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_rank_tiers_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: true;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_rewards: {
        Row: {
          approved_by: string | null;
          cost: number;
          couple_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          responded_at: string | null;
          status: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          approved_by?: string | null;
          cost: number;
          couple_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          responded_at?: string | null;
          status?: string;
          title: string;
        };
        Update: {
          approved_by?: string | null;
          cost?: number;
          couple_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          responded_at?: string | null;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "couple_rewards_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couples: {
        Row: {
          anniversary: string | null;
          created_at: string;
          created_by: string | null;
          dissolved_at: string | null;
          id: string;
          name: string;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          anniversary?: string | null;
          created_at?: string;
          created_by?: string | null;
          dissolved_at?: string | null;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Update: {
          anniversary?: string | null;
          created_at?: string;
          created_by?: string | null;
          dissolved_at?: string | null;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      currency_transactions: {
        Row: {
          amount: number;
          balance_after: number;
          created_at: string;
          id: string;
          reason: string;
          ref_id: string;
          user_id: string;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          balance_after: number;
          created_at?: string;
          id?: string;
          reason: string;
          ref_id: string;
          user_id: string;
          xp?: number;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          created_at?: string;
          id?: string;
          reason?: string;
          ref_id?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
      daily_love_answers: {
        Row: {
          answer: string;
          couple_id: string;
          created_at: string;
          day: string;
          question_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer: string;
          couple_id: string;
          created_at?: string;
          day: string;
          question_id: string;
          user_id: string;
        };
        Update: {
          answer?: string;
          couple_id?: string;
          created_at?: string;
          day?: string;
          question_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_love_answers_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_love_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "daily_love_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_love_questions: {
        Row: {
          helper_phrase: string | null;
          id: string;
          prompt: string;
          prompt_vi: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          helper_phrase?: string | null;
          id: string;
          prompt: string;
          prompt_vi: string;
          sort_order: number;
        };
        Update: {
          helper_phrase?: string | null;
          id?: string;
          prompt?: string;
          prompt_vi?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      daily_quests: {
        Row: {
          category: string | null;
          coin_reward: number;
          event: string;
          id: string;
          slot: string;
          target: number;
          title: string;
          title_vi: string;
          xp_reward: number;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          coin_reward: number;
          event: string;
          id: string;
          slot: string;
          target: number;
          title: string;
          title_vi: string;
          xp_reward: number;
        };
        Update: {
          category?: string | null;
          coin_reward?: number;
          event?: string;
          id?: string;
          slot?: string;
          target?: number;
          title?: string;
          title_vi?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          responded_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          responded_at?: string | null;
          status?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          responded_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      furniture_placements: {
        Row: {
          couple_id: string;
          flipped: boolean;
          id: string;
          inventory_id: string;
          placed_by: string | null;
          updated_at: string;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          flipped?: boolean;
          id?: string;
          inventory_id: string;
          placed_by?: string | null;
          updated_at?: string;
          x: number;
          y: number;
        };
        Update: {
          couple_id?: string;
          flipped?: boolean;
          id?: string;
          inventory_id?: string;
          placed_by?: string | null;
          updated_at?: string;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "furniture_placements_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "furniture_placements_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: true;
            referencedRelation: "inventories";
            referencedColumns: ["id"];
          },
        ];
      };
      game_invitations: {
        Row: {
          created_at: string;
          expires_at: string;
          from_user: string;
          game: string;
          id: string;
          language: string;
          question_ids: string[] | null;
          responded_at: string | null;
          status: string;
          to_user: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string;
          from_user: string;
          game: string;
          id?: string;
          language: string;
          question_ids?: string[] | null;
          responded_at?: string | null;
          status?: string;
          to_user: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          from_user?: string;
          game?: string;
          id?: string;
          language?: string;
          question_ids?: string[] | null;
          responded_at?: string | null;
          status?: string;
          to_user?: string;
        };
        Relationships: [];
      };
      game_sessions: {
        Row: {
          adventure_id: string | null;
          coins_awarded: number;
          completed_at: string | null;
          correct_count: number | null;
          id: string;
          invitation_id: string | null;
          kind: Database["public"]["Enums"]["game_kind"];
          question_ids: string[];
          started_at: string;
          subject_id: string | null;
          unit_id: string | null;
          user_id: string;
          won: boolean | null;
          xp_awarded: number;
        };
        ComputedFields: never;
        Insert: {
          adventure_id?: string | null;
          coins_awarded?: number;
          completed_at?: string | null;
          correct_count?: number | null;
          id?: string;
          invitation_id?: string | null;
          kind: Database["public"]["Enums"]["game_kind"];
          question_ids: string[];
          started_at?: string;
          subject_id?: string | null;
          unit_id?: string | null;
          user_id: string;
          won?: boolean | null;
          xp_awarded?: number;
        };
        Update: {
          adventure_id?: string | null;
          coins_awarded?: number;
          completed_at?: string | null;
          correct_count?: number | null;
          id?: string;
          invitation_id?: string | null;
          kind?: Database["public"]["Enums"]["game_kind"];
          question_ids?: string[];
          started_at?: string;
          subject_id?: string | null;
          unit_id?: string | null;
          user_id?: string;
          won?: boolean | null;
          xp_awarded?: number;
        };
        Relationships: [
          {
            foreignKeyName: "game_sessions_adventure_id_fkey";
            columns: ["adventure_id"];
            isOneToOne: false;
            referencedRelation: "couple_adventures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_sessions_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "game_invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_sessions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_sessions_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "learning_units";
            referencedColumns: ["id"];
          },
        ];
      };
      home_guestbook_messages: {
        Row: {
          author_id: string;
          body: string;
          couple_id: string;
          created_at: string;
          hidden_at: string | null;
          id: string;
          guestbook_json: Json | null;
        };
        ComputedFields: "guestbook_json";
        Insert: {
          author_id: string;
          body: string;
          couple_id: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          couple_id?: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "home_guestbook_messages_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      home_visits: {
        Row: {
          created_at: string;
          host_couple_id: string;
          id: string;
          visitor_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          host_couple_id: string;
          id?: string;
          visitor_id: string;
        };
        Update: {
          created_at?: string;
          host_couple_id?: string;
          id?: string;
          visitor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "home_visits_host_couple_id_fkey";
            columns: ["host_couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      inventories: {
        Row: {
          acquired_at: string;
          couple_id: string | null;
          id: string;
          item_id: string;
          source: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          acquired_at?: string;
          couple_id?: string | null;
          id?: string;
          item_id: string;
          source?: string;
          user_id: string;
        };
        Update: {
          acquired_at?: string;
          couple_id?: string | null;
          id?: string;
          item_id?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventories_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventories_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "shop_items";
            referencedColumns: ["id"];
          },
        ];
      };
      leaderboard_point_events: {
        Row: {
          couple_id: string;
          created_at: string;
          day: string;
          id: string;
          points: number;
          ref: string;
          source: string;
          user_id: string | null;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          created_at?: string;
          day: string;
          id?: string;
          points: number;
          ref: string;
          source: string;
          user_id?: string | null;
          week_start: string;
        };
        Update: {
          couple_id?: string;
          created_at?: string;
          day?: string;
          id?: string;
          points?: number;
          ref?: string;
          source?: string;
          user_id?: string | null;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leaderboard_point_events_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      leaderboard_scores: {
        Row: {
          couple_id: string;
          last_scored_at: string;
          member_points: NonNullable<Json>;
          score: number;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          last_scored_at?: string;
          member_points?: NonNullable<Json>;
          score?: number;
          week_start: string;
        };
        Update: {
          couple_id?: string;
          last_scored_at?: string;
          member_points?: NonNullable<Json>;
          score?: number;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leaderboard_scores_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      leaderboard_seasons: {
        Row: {
          ends_on: string;
          id: number;
          name: string;
          starts_on: string;
        };
        ComputedFields: never;
        Insert: {
          ends_on: string;
          id: number;
          name: string;
          starts_on: string;
        };
        Update: {
          ends_on?: string;
          id?: number;
          name?: string;
          starts_on?: string;
        };
        Relationships: [];
      };
      leaderboard_snapshots: {
        Row: {
          couple_id: string;
          rank: number;
          score: number;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          couple_id: string;
          rank: number;
          score: number;
          week_start: string;
        };
        Update: {
          couple_id?: string;
          rank?: number;
          score?: number;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshots_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leaderboard_snapshots_week_start_fkey";
            columns: ["week_start"];
            isOneToOne: false;
            referencedRelation: "leaderboard_weeks";
            referencedColumns: ["week_start"];
          },
        ];
      };
      leaderboard_weeks: {
        Row: {
          finalized_at: string;
          participants: number;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          finalized_at?: string;
          participants: number;
          week_start: string;
        };
        Update: {
          finalized_at?: string;
          participants?: number;
          week_start?: string;
        };
        Relationships: [];
      };
      learning_categories: {
        Row: {
          description: string;
          id: string;
          name: string;
          name_vi: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          id: string;
          name: string;
          name_vi: string;
          sort_order: number;
        };
        Update: {
          description?: string;
          id?: string;
          name?: string;
          name_vi?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      learning_units: {
        Row: {
          boss_name: string | null;
          boss_questions: number | null;
          description: string;
          id: string;
          level: string;
          location: string;
          number: number;
          reward_item_id: string | null;
          status: string;
          subject_id: string;
          title: string;
          title_vi: string;
        };
        ComputedFields: never;
        Insert: {
          boss_name?: string | null;
          boss_questions?: number | null;
          description: string;
          id: string;
          level: string;
          location: string;
          number: number;
          reward_item_id?: string | null;
          status: string;
          subject_id: string;
          title: string;
          title_vi: string;
        };
        Update: {
          boss_name?: string | null;
          boss_questions?: number | null;
          description?: string;
          id?: string;
          level?: string;
          location?: string;
          number?: number;
          reward_item_id?: string | null;
          status?: string;
          subject_id?: string;
          title?: string;
          title_vi?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_units_reward_item_id_fkey";
            columns: ["reward_item_id"];
            isOneToOne: false;
            referencedRelation: "shop_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_units_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_units_subject_id_level_fkey";
            columns: ["subject_id", "level"];
            isOneToOne: false;
            referencedRelation: "subject_levels";
            referencedColumns: ["subject_id", "level"];
          },
        ];
      };
      legend_celebrations: {
        Row: {
          milestone: string;
          seen_at: string;
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          milestone: string;
          seen_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          milestone?: string;
          seen_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      lesson_attempts: {
        Row: {
          coins_awarded: number;
          completed_at: string | null;
          correct_count: number | null;
          id: string;
          lesson_id: string;
          started_at: string;
          total_count: number | null;
          user_id: string;
          xp_awarded: number;
        };
        ComputedFields: never;
        Insert: {
          coins_awarded?: number;
          completed_at?: string | null;
          correct_count?: number | null;
          id?: string;
          lesson_id: string;
          started_at?: string;
          total_count?: number | null;
          user_id: string;
          xp_awarded?: number;
        };
        Update: {
          coins_awarded?: number;
          completed_at?: string | null;
          correct_count?: number | null;
          id?: string;
          lesson_id?: string;
          started_at?: string;
          total_count?: number | null;
          user_id?: string;
          xp_awarded?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_attempts_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_questions: {
        Row: {
          answers: NonNullable<Json>;
          audio_text: string | null;
          explanation: string;
          explanation_vi: string;
          hint: string | null;
          hint_vi: string | null;
          id: string;
          kind: Database["public"]["Enums"]["question_kind"];
          lesson_id: string;
          level: string;
          objective: string;
          options: Json | null;
          position: number;
          prompt: string;
          prompt_vi: string | null;
          tokens: Json | null;
          word: Json | null;
          word_term: string | null;
        };
        ComputedFields: never;
        Insert: {
          answers: NonNullable<Json>;
          audio_text?: string | null;
          explanation: string;
          explanation_vi: string;
          hint?: string | null;
          hint_vi?: string | null;
          id: string;
          kind: Database["public"]["Enums"]["question_kind"];
          lesson_id: string;
          level: string;
          objective: string;
          options?: Json | null;
          position: number;
          prompt: string;
          prompt_vi?: string | null;
          tokens?: Json | null;
          word?: Json | null;
          word_term?: string | null;
        };
        Update: {
          answers?: NonNullable<Json>;
          audio_text?: string | null;
          explanation?: string;
          explanation_vi?: string;
          hint?: string | null;
          hint_vi?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["question_kind"];
          lesson_id?: string;
          level?: string;
          objective?: string;
          options?: Json | null;
          position?: number;
          prompt?: string;
          prompt_vi?: string | null;
          tokens?: Json | null;
          word?: Json | null;
          word_term?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_questions_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          category_id: string;
          id: string;
          intro: Json | null;
          language: string | null;
          level: string;
          objectives: string[];
          sort_order: number;
          subject_id: string;
          title: string;
          title_vi: string;
          topic: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          id: string;
          intro?: Json | null;
          language?: string | null;
          level: string;
          objectives: string[];
          sort_order: number;
          subject_id: string;
          title: string;
          title_vi: string;
          topic: string;
        };
        Update: {
          category_id?: string;
          id?: string;
          intro?: Json | null;
          language?: string | null;
          level?: string;
          objectives?: string[];
          sort_order?: number;
          subject_id?: string;
          title?: string;
          title_vi?: string;
          topic?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "learning_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      love_messages: {
        Row: {
          body: string | null;
          couple_id: string;
          created_at: string;
          id: string;
          item_id: string | null;
          kind: string;
          opened_at: string | null;
          read_at: string | null;
          recipient_id: string;
          saved: boolean;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          couple_id: string;
          created_at?: string;
          id?: string;
          item_id?: string | null;
          kind: string;
          opened_at?: string | null;
          read_at?: string | null;
          recipient_id: string;
          saved?: boolean;
          sender_id: string;
        };
        Update: {
          body?: string | null;
          couple_id?: string;
          created_at?: string;
          id?: string;
          item_id?: string | null;
          kind?: string;
          opened_at?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          saved?: boolean;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "love_messages_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "love_messages_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "shop_items";
            referencedColumns: ["id"];
          },
        ];
      };
      memories: {
        Row: {
          body: string | null;
          couple_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          meta: NonNullable<Json>;
          occurred_on: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          couple_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          meta?: NonNullable<Json>;
          occurred_on?: string;
          title: string;
        };
        Update: {
          body?: string | null;
          couple_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          meta?: NonNullable<Json>;
          occurred_on?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memories_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      placement_results: {
        Row: {
          correct: number;
          created_at: string;
          id: string;
          recommended_level: string;
          score_by_level: NonNullable<Json>;
          session_id: string | null;
          subject_id: string;
          total: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          correct: number;
          created_at?: string;
          id?: string;
          recommended_level: string;
          score_by_level: NonNullable<Json>;
          session_id?: string | null;
          subject_id: string;
          total: number;
          user_id: string;
        };
        Update: {
          correct?: number;
          created_at?: string;
          id?: string;
          recommended_level?: string;
          score_by_level?: NonNullable<Json>;
          session_id?: string | null;
          subject_id?: string;
          total?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "placement_results_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "game_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_results_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar: NonNullable<Json>;
          chinese_level: number;
          created_at: string;
          display_name: string;
          english_level: Database["public"]["Enums"]["cefr_level"];
          equipped_emotes: string[];
          id: string;
          learning_language: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar?: NonNullable<Json>;
          chinese_level?: number;
          created_at?: string;
          display_name: string;
          english_level?: Database["public"]["Enums"]["cefr_level"];
          equipped_emotes?: string[];
          id: string;
          learning_language?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar?: NonNullable<Json>;
          chinese_level?: number;
          created_at?: string;
          display_name?: string;
          english_level?: Database["public"]["Enums"]["cefr_level"];
          equipped_emotes?: string[];
          id?: string;
          learning_language?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_attempts: {
        Row: {
          answer: string;
          attempt_no: number;
          created_at: string;
          game_session_id: string | null;
          id: string;
          is_correct: boolean;
          lesson_attempt_id: string | null;
          question_id: string;
          source: Database["public"]["Enums"]["answer_source"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer: string;
          attempt_no?: number;
          created_at?: string;
          game_session_id?: string | null;
          id?: string;
          is_correct: boolean;
          lesson_attempt_id?: string | null;
          question_id: string;
          source: Database["public"]["Enums"]["answer_source"];
          user_id: string;
        };
        Update: {
          answer?: string;
          attempt_no?: number;
          created_at?: string;
          game_session_id?: string | null;
          id?: string;
          is_correct?: boolean;
          lesson_attempt_id?: string | null;
          question_id?: string;
          source?: Database["public"]["Enums"]["answer_source"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_attempts_game_session_id_fkey";
            columns: ["game_session_id"];
            isOneToOne: false;
            referencedRelation: "game_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_attempts_lesson_attempt_id_fkey";
            columns: ["lesson_attempt_id"];
            isOneToOne: false;
            referencedRelation: "lesson_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "lesson_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "question_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      ranking_reward_claims: {
        Row: {
          claimed_at: string;
          coins_per_member: number;
          couple_id: string;
          effect: string | null;
          effect_expires_at: string | null;
          rank: number;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          claimed_at?: string;
          coins_per_member: number;
          couple_id: string;
          effect?: string | null;
          effect_expires_at?: string | null;
          rank: number;
          week_start: string;
        };
        Update: {
          claimed_at?: string;
          coins_per_member?: number;
          couple_id?: string;
          effect?: string | null;
          effect_expires_at?: string | null;
          rank?: number;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ranking_reward_claims_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ranking_reward_claims_week_start_fkey";
            columns: ["week_start"];
            isOneToOne: false;
            referencedRelation: "leaderboard_weeks";
            referencedColumns: ["week_start"];
          },
        ];
      };
      ranking_rewards: {
        Row: {
          badge_achievement: string;
          coins: number;
          effect: string | null;
          effect_days: number;
          rank_from: number;
          rank_to: number;
          trophy_item: string | null;
        };
        ComputedFields: never;
        Insert: {
          badge_achievement: string;
          coins: number;
          effect?: string | null;
          effect_days?: number;
          rank_from: number;
          rank_to: number;
          trophy_item?: string | null;
        };
        Update: {
          badge_achievement?: string;
          coins?: number;
          effect?: string | null;
          effect_days?: number;
          rank_from?: number;
          rank_to?: number;
          trophy_item?: string | null;
        };
        Relationships: [];
      };
      review_progress: {
        Row: {
          box: number;
          correct_count: number;
          first_learned_at: string | null;
          incorrect_count: number;
          last_reviewed_at: string;
          next_review_at: string;
          question_id: string;
          review_count: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          box?: number;
          correct_count?: number;
          first_learned_at?: string | null;
          incorrect_count?: number;
          last_reviewed_at?: string;
          next_review_at?: string;
          question_id: string;
          review_count?: number;
          user_id: string;
        };
        Update: {
          box?: number;
          correct_count?: number;
          first_learned_at?: string | null;
          incorrect_count?: number;
          last_reviewed_at?: string;
          next_review_at?: string;
          question_id?: string;
          review_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_progress_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "lesson_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_progress_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "question_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      reward_redemptions: {
        Row: {
          cost: number;
          couple_id: string;
          fulfilled_at: string | null;
          id: string;
          redeemed_at: string;
          redeemed_by: string | null;
          reward_id: string;
        };
        ComputedFields: never;
        Insert: {
          cost: number;
          couple_id: string;
          fulfilled_at?: string | null;
          id?: string;
          redeemed_at?: string;
          redeemed_by?: string | null;
          reward_id: string;
        };
        Update: {
          cost?: number;
          couple_id?: string;
          fulfilled_at?: string | null;
          id?: string;
          redeemed_at?: string;
          redeemed_by?: string | null;
          reward_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "couple_rewards";
            referencedColumns: ["id"];
          },
        ];
      };
      room_dimensions: {
        Row: {
          depth: number;
          id: boolean;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          depth: number;
          id?: boolean;
          width: number;
        };
        Update: {
          depth?: number;
          id?: boolean;
          width?: number;
        };
        Relationships: [];
      };
      room_reserved_tiles: {
        Row: {
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          x: number;
          y: number;
        };
        Update: {
          x?: number;
          y?: number;
        };
        Relationships: [];
      };
      shop_items: {
        Row: {
          asset_key: string;
          category: string;
          description: string;
          footprint_h: number;
          footprint_w: number;
          id: string;
          min_home_level: number;
          name: string;
          name_vi: string;
          price: number;
          shop_visible: boolean;
        };
        ComputedFields: never;
        Insert: {
          asset_key: string;
          category: string;
          description: string;
          footprint_h?: number;
          footprint_w?: number;
          id: string;
          min_home_level?: number;
          name: string;
          name_vi: string;
          price: number;
          shop_visible?: boolean;
        };
        Update: {
          asset_key?: string;
          category?: string;
          description?: string;
          footprint_h?: number;
          footprint_w?: number;
          id?: string;
          min_home_level?: number;
          name?: string;
          name_vi?: string;
          price?: number;
          shop_visible?: boolean;
        };
        Relationships: [];
      };
      social_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      social_reports: {
        Row: {
          created_at: string;
          details: string | null;
          guestbook_id: string | null;
          id: string;
          message_id: string | null;
          reason: string;
          reporter_id: string;
          status: string;
          target_user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          guestbook_id?: string | null;
          id?: string;
          message_id?: string | null;
          reason: string;
          reporter_id: string;
          status?: string;
          target_user_id: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          guestbook_id?: string | null;
          id?: string;
          message_id?: string | null;
          reason?: string;
          reporter_id?: string;
          status?: string;
          target_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_reports_guestbook_id_fkey";
            columns: ["guestbook_id"];
            isOneToOne: false;
            referencedRelation: "home_guestbook_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "world_chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      streaks: {
        Row: {
          current: number;
          freezes: number;
          last_active_date: string | null;
          longest: number;
          subject_id: string;
          subject_type: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          current?: number;
          freezes?: number;
          last_active_date?: string | null;
          longest?: number;
          subject_id: string;
          subject_type: string;
          updated_at?: string;
        };
        Update: {
          current?: number;
          freezes?: number;
          last_active_date?: string | null;
          longest?: number;
          subject_id?: string;
          subject_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subject_levels: {
        Row: {
          lesson_target: number;
          level: string;
          sort_order: number;
          subject_id: string;
          title: string;
          title_vi: string;
        };
        ComputedFields: never;
        Insert: {
          lesson_target?: number;
          level: string;
          sort_order: number;
          subject_id: string;
          title: string;
          title_vi: string;
        };
        Update: {
          lesson_target?: number;
          level?: string;
          sort_order?: number;
          subject_id?: string;
          title?: string;
          title_vi?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_levels_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          description: string;
          description_vi: string;
          id: string;
          language: string | null;
          name: string;
          name_vi: string;
          sort_order: number;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          description_vi: string;
          id: string;
          language?: string | null;
          name: string;
          name_vi: string;
          sort_order: number;
          status: string;
        };
        Update: {
          description?: string;
          description_vi?: string;
          id?: string;
          language?: string | null;
          name?: string;
          name_vi?: string;
          sort_order?: number;
          status?: string;
        };
        Relationships: [];
      };
      unit_lessons: {
        Row: {
          lesson_id: string;
          position: number;
          unit_id: string;
        };
        ComputedFields: never;
        Insert: {
          lesson_id: string;
          position: number;
          unit_id: string;
        };
        Update: {
          lesson_id?: string;
          position?: number;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unit_lessons_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: true;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_lessons_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "learning_units";
            referencedColumns: ["id"];
          },
        ];
      };
      unit_progress: {
        Row: {
          boss_attempts: number;
          boss_best_pct: number;
          boss_cleared_at: string | null;
          review_completed_at: string | null;
          stars: number;
          unit_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          boss_attempts?: number;
          boss_best_pct?: number;
          boss_cleared_at?: string | null;
          review_completed_at?: string | null;
          stars?: number;
          unit_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          boss_attempts?: number;
          boss_best_pct?: number;
          boss_cleared_at?: string | null;
          review_completed_at?: string | null;
          stars?: number;
          unit_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unit_progress_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "learning_units";
            referencedColumns: ["id"];
          },
        ];
      };
      user_achievements: {
        Row: {
          achievement_id: string;
          couple_id: string | null;
          unlocked_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          achievement_id: string;
          couple_id?: string | null;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          couple_id?: string | null;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_achievements_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      user_progress: {
        Row: {
          coins: number;
          games_won: number;
          lessons_completed: number;
          level: number;
          puzzles_solved: number;
          updated_at: string;
          user_id: string;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          coins?: number;
          games_won?: number;
          lessons_completed?: number;
          level?: number;
          puzzles_solved?: number;
          updated_at?: string;
          user_id: string;
          xp?: number;
        };
        Update: {
          coins?: number;
          games_won?: number;
          lessons_completed?: number;
          level?: number;
          puzzles_solved?: number;
          updated_at?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
      user_quest_progress: {
        Row: {
          claimed_at: string | null;
          completed_at: string | null;
          day: string;
          progress: number;
          quest_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          claimed_at?: string | null;
          completed_at?: string | null;
          day: string;
          progress?: number;
          quest_id: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string | null;
          completed_at?: string | null;
          day?: string;
          progress?: number;
          quest_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_quest_progress_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "daily_quests";
            referencedColumns: ["id"];
          },
        ];
      };
      world_chat_messages: {
        Row: {
          body: string;
          channel: string;
          client_id: string;
          created_at: string;
          hidden_at: string | null;
          id: string;
          user_id: string;
          message_json: Json | null;
        };
        ComputedFields: "message_json";
        Insert: {
          body: string;
          channel: string;
          client_id: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          channel?: string;
          client_id?: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      question_cards: {
        Row: {
          audio_text: string | null;
          category_id: string;
          hint: string | null;
          hint_vi: string | null;
          id: string;
          kind: Database["public"]["Enums"]["question_kind"];
          language: string | null;
          lesson_id: string;
          level: string;
          objective: string;
          options: Json | null;
          position: number;
          prompt: string;
          prompt_vi: string | null;
          subject_id: string;
          tokens: Json | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "lesson_questions_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "learning_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_invitation: { Args: { invite_code: string }; Returns: string };
      ack_legend_celebration: {
        Args: { milestone: string };
        Returns: undefined;
      };
      add_couple_progress: {
        Args: {
          add_energy: number;
          add_xp: number;
          cid: string;
          source: string;
        };
        Returns: undefined;
      };
      add_ranking_points: {
        Args: {
          add_points: number;
          cid: string;
          point_ref: string;
          point_source: string;
          uid: string;
        };
        Returns: number;
      };
      add_special_memory: {
        Args: {
          memory_body: string;
          memory_date: string;
          memory_title: string;
        };
        Returns: string;
      };
      advance_streak: {
        Args: { kind: string; subject: string; today: string };
        Returns: number;
      };
      answer_love_question: { Args: { answer_text: string }; Returns: Json };
      archive_reward: { Args: { reward: string }; Returns: undefined };
      are_friends: { Args: { a: string; b: string }; Returns: boolean };
      block_player: { Args: { target: string }; Returns: undefined };
      blocked_between: { Args: { a: string; b: string }; Returns: boolean };
      blocked_with_couple: {
        Args: { cid: string; uid: string };
        Returns: boolean;
      };
      can_join_social_topic: { Args: { topic: string }; Returns: boolean };
      check_user_achievements: { Args: { uid: string }; Returns: undefined };
      claim_daily_quest: { Args: { quest: string }; Returns: Json };
      complete_couple_quest: {
        Args: {
          cid: string;
          cq: Omit<
            Database["public"]["Tables"]["couple_quests"]["Row"],
            Database["public"]["Tables"]["couple_quests"]["ComputedFields"]
          >;
          period: string;
        };
        Returns: undefined;
      };
      complete_lesson: { Args: { lesson_attempt: string }; Returns: Json };
      completed_lessons: {
        Args: { uid: string };
        Returns: {
          lesson_id: string;
        }[];
      };
      couple_card: { Args: { cid: string; viewer: string }; Returns: Json };
      couple_local_date: { Args: { target_couple: string }; Returns: string };
      couple_members_public: { Args: { cid: string }; Returns: Json };
      create_invitation: {
        Args: Record<PropertyKey, never>;
        Returns: {
          code: string;
          couple_id: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
          used_at: string | null;
          used_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "couple_invitations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_guestbook_message: {
        Args: { message: string };
        Returns: undefined;
      };
      delete_memory: { Args: { memory: string }; Returns: undefined };
      delete_world_message: { Args: { message: string }; Returns: undefined };
      emit_event: {
        Args: {
          amount: number;
          event_category: string;
          event_name: string;
          uid: string;
        };
        Returns: undefined;
      };
      finalize_due_legend_weeks: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      finalize_legend_week: { Args: { week: string }; Returns: number };
      finish_adventure_part: { Args: { game_session: string }; Returns: Json };
      finish_duel: { Args: { game_session: string }; Returns: Json };
      finish_game: { Args: { game_session: string }; Returns: Json };
      finish_placement: { Args: { game_session: string }; Returns: Json };
      finish_unit_challenge: { Args: { game_session: string }; Returns: Json };
      friendship_status: {
        Args: { target: string; uid: string };
        Returns: string;
      };
      fulfill_redemption: { Args: { redemption: string }; Returns: undefined };
      generate_invite_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_adventure_map: {
        Args: { map_level: string; subject: string };
        Returns: Json;
      };
      get_blocked_players: { Args: Record<PropertyKey, never>; Returns: Json };
      get_couple_adventures: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_couple_legend_profile: { Args: { target: string }; Returns: Json };
      get_couple_quests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          coin_reward: number;
          completed: boolean;
          couple_xp: number;
          description: string;
          id: string;
          love_energy: number;
          member_progress: Json;
          mode: string;
          target: number;
          title: string;
          title_vi: string;
          week_start: string;
        }[];
      };
      get_couple_world_profile: { Args: { target: string }; Returns: Json };
      get_daily_quests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          claimed: boolean;
          coin_reward: number;
          completed: boolean;
          day: string;
          id: string;
          progress: number;
          slot: string;
          target: number;
          title: string;
          title_vi: string;
          xp_reward: number;
        }[];
      };
      get_discover_couples: {
        Args: { page?: number; page_size?: number; sort?: string };
        Returns: Json;
      };
      get_game_invitations: { Args: Record<PropertyKey, never>; Returns: Json };
      get_guestbook: {
        Args: { before_id?: string; max_rows?: number; target: string };
        Returns: Json;
      };
      get_leaderboard: {
        Args: { board?: string; max_rows?: number };
        Returns: {
          couple_id: string;
          couple_name: string;
          effect: string;
          is_me: boolean;
          members: Json;
          movement: number;
          rank: number;
          score: number;
          tier: number;
        }[];
      };
      get_learning_universe: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_love_answer_history: {
        Args: { max_days?: number };
        Returns: {
          day: string;
          my_answer: string;
          partner_answer: string;
          prompt: string;
          question_id: string;
        }[];
      };
      get_my_legend_status: { Args: Record<PropertyKey, never>; Returns: Json };
      get_player_cards: { Args: { ids: string[] }; Returns: Json };
      get_player_profile: { Args: { target: string }; Returns: Json };
      get_review_queue: {
        Args: { max_items?: number };
        Returns: {
          audio_text: string | null;
          category_id: string;
          hint: string | null;
          hint_vi: string | null;
          id: string;
          kind: Database["public"]["Enums"]["question_kind"];
          language: string | null;
          lesson_id: string;
          level: string;
          objective: string;
          options: Json | null;
          position: number;
          prompt: string;
          prompt_vi: string | null;
          subject_id: string;
          tokens: Json | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "question_cards";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_social_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      get_today_love_question: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_word_bank: {
        Args: Record<PropertyKey, never>;
        Returns: {
          box: number;
          correct_count: number;
          incorrect_count: number;
          language: string;
          next_review_at: string;
          question_id: string;
          word: Json;
        }[];
      };
      get_world_messages: {
        Args: { before_id?: string; channel: string; max_rows?: number };
        Returns: Json;
      };
      grant_reward: {
        Args: {
          add_coins: number;
          add_xp: number;
          reason: string;
          ref: string;
          uid: string;
        };
        Returns: Json;
      };
      guestbook_json: {
        Args: {
          g: Omit<
            Database["public"]["Tables"]["home_guestbook_messages"]["Row"],
            Database["public"]["Tables"]["home_guestbook_messages"]["ComputedFields"]
          >;
        };
        Returns: Json;
      };
      has_answered_love_question: {
        Args: { target_couple: string; target_day: string };
        Returns: boolean;
      };
      home_level_for_energy: { Args: { energy: number }; Returns: number };
      invitation_json: {
        Args: {
          inv: Omit<
            Database["public"]["Tables"]["game_invitations"]["Row"],
            Database["public"]["Tables"]["game_invitations"]["ComputedFields"]
          >;
          viewer: string;
        };
        Returns: Json;
      };
      is_couple_member: { Args: { target_couple: string }; Returns: boolean };
      learner_level: {
        Args: { uid: string };
        Returns: {
          language: string;
          rank: number;
        }[];
      };
      leave_couple: { Args: Record<PropertyKey, never>; Returns: undefined };
      legend_tier_for_points: { Args: { points: number }; Returns: number };
      legend_week_start: { Args: { at_time?: string }; Returns: string };
      level_for_xp: {
        Args: { multiplier?: number; total_xp: number };
        Returns: number;
      };
      level_rank: { Args: { level: string }; Returns: number };
      love_question_for_day: {
        Args: { target_day: string };
        Returns: {
          helper_phrase: string | null;
          id: string;
          prompt: string;
          prompt_vi: string;
          sort_order: number;
        };
        SetofOptions: {
          from: "*";
          to: "daily_love_questions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_messages_read: { Args: Record<PropertyKey, never>; Returns: number };
      message_json: {
        Args: {
          msg: Omit<
            Database["public"]["Tables"]["world_chat_messages"]["Row"],
            Database["public"]["Tables"]["world_chat_messages"]["ComputedFields"]
          >;
        };
        Returns: Json;
      };
      my_couple_id: { Args: Record<PropertyKey, never>; Returns: string };
      my_partner_id: { Args: Record<PropertyKey, never>; Returns: string };
      normalize_answer: { Args: { raw: string }; Returns: string };
      open_gift: { Args: { message: string }; Returns: undefined };
      player_card: { Args: { uid: string }; Returns: Json };
      propose_reward: {
        Args: {
          reward_cost: number;
          reward_description: string;
          reward_title: string;
        };
        Returns: string;
      };
      purchase_item: {
        Args: { item: string; request_id: string };
        Returns: Json;
      };
      quests_for_day: {
        Args: { target_day: string };
        Returns: {
          category: string | null;
          coin_reward: number;
          event: string;
          id: string;
          slot: string;
          target: number;
          title: string;
          title_vi: string;
          xp_reward: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "daily_quests";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      rebuild_legend_totals: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      record_qualifying_activity: { Args: { uid: string }; Returns: undefined };
      redeem_reward: {
        Args: { request_id: string; reward: string };
        Returns: Json;
      };
      remove_friend: { Args: { target: string }; Returns: undefined };
      report_player: {
        Args: {
          details?: string;
          guestbook?: string;
          message?: string;
          reason: string;
          target: string;
        };
        Returns: Json;
      };
      require_couple: { Args: Record<PropertyKey, never>; Returns: string };
      require_user: { Args: Record<PropertyKey, never>; Returns: string };
      respond_friend_request: {
        Args: { accept: boolean; request: string };
        Returns: string;
      };
      respond_game_invitation: {
        Args: { accept: boolean; invitation: string };
        Returns: Json;
      };
      respond_interaction: {
        Args: { accept: boolean; interaction: string };
        Returns: {
          couple_id: string;
          created_at: string;
          from_user: string;
          id: string;
          kind: string;
          responded_at: string | null;
          status: string;
          to_user: string;
        };
        SetofOptions: {
          from: "*";
          to: "couple_interactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      respond_reward: {
        Args: { approve: boolean; reward: string };
        Returns: undefined;
      };
      revoke_invitation: {
        Args: { invitation_id: string };
        Returns: undefined;
      };
      save_message_as_memory: { Args: { message: string }; Returns: string };
      save_room_layout: { Args: { layout: Json }; Returns: number };
      send_friend_request: { Args: { target: string }; Returns: string };
      send_game_invitation: {
        Args: { game: string; target: string };
        Returns: Json;
      };
      send_gift: {
        Args: { item: string; note: string; request_id: string };
        Returns: Json;
      };
      send_interaction: {
        Args: { interaction_kind: string };
        Returns: {
          couple_id: string;
          created_at: string;
          from_user: string;
          id: string;
          kind: string;
          responded_at: string | null;
          status: string;
          to_user: string;
        };
        SetofOptions: {
          from: "*";
          to: "couple_interactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      send_love_message: {
        Args: { message_body?: string; message_kind: string };
        Returns: string;
      };
      send_world_message: {
        Args: { body: string; channel: string; client_id: string };
        Returns: Json;
      };
      set_legend_visibility: {
        Args: { make_public: boolean };
        Returns: undefined;
      };
      sign_guestbook: { Args: { body: string; target: string }; Returns: Json };
      srs_interval: { Args: { box: number }; Returns: string };
      start_adventure_part: { Args: { adventure: string }; Returns: Json };
      start_duel: { Args: { invitation: string }; Returns: Json };
      start_game: {
        Args: { game: Database["public"]["Enums"]["game_kind"] };
        Returns: Json;
      };
      start_home_visit: { Args: { target: string }; Returns: Json };
      start_lesson: { Args: { target_lesson: string }; Returns: string };
      start_placement: { Args: { subject: string }; Returns: Json };
      start_unit_challenge: {
        Args: { mode: string; target_unit: string };
        Returns: Json;
      };
      subject_level_for: {
        Args: { subject: string; uid: string };
        Returns: string;
      };
      submit_answer: {
        Args: {
          answer: string;
          game_session?: string;
          lesson_attempt?: string;
          question: string;
          review?: boolean;
        };
        Returns: Json;
      };
      total_xp_for_level: {
        Args: { multiplier?: number; target_level: number };
        Returns: number;
      };
      unblock_player: { Args: { target: string }; Returns: undefined };
      unit_state: { Args: { target_unit: string; uid: string }; Returns: Json };
      unlock_couple_achievement: {
        Args: { achievement: string; cid: string };
        Returns: undefined;
      };
      unlock_user_achievement: {
        Args: { achievement: string; uid: string };
        Returns: boolean;
      };
      update_review_progress: {
        Args: { correct: boolean; qid: string; uid: string };
        Returns: boolean;
      };
      user_local_date: { Args: { target_user: string }; Returns: string };
      week_start: { Args: { target_day: string }; Returns: string };
      word_count: { Args: { raw: string }; Returns: number };
    };
    Enums: {
      answer_source:
        | "lesson"
        | "review"
        | "word_battle"
        | "sentence_puzzle"
        | "boss"
        | "unit_review"
        | "placement"
        | "adventure"
        | "word_duel";
      cefr_level: "A1" | "A2" | "B1" | "B2" | "C1";
      game_kind:
        | "word_battle"
        | "sentence_puzzle"
        | "boss"
        | "unit_review"
        | "placement"
        | "adventure"
        | "word_duel";
      question_kind: "multiple_choice" | "sentence_order" | "listening";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      answer_source: [
        "lesson",
        "review",
        "word_battle",
        "sentence_puzzle",
        "boss",
        "unit_review",
        "placement",
        "adventure",
        "word_duel",
      ],
      cefr_level: ["A1", "A2", "B1", "B2", "C1"],
      game_kind: [
        "word_battle",
        "sentence_puzzle",
        "boss",
        "unit_review",
        "placement",
        "adventure",
        "word_duel",
      ],
      question_kind: ["multiple_choice", "sentence_order", "listening"],
    },
  },
} as const;
