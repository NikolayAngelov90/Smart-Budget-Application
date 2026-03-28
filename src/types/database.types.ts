/**
 * Database Types
 * Story 1.2: Supabase Project Setup and Database Schema
 *
 * TypeScript types for Supabase database schema
 * Generated from: supabase/migrations/001_initial_schema.sql
 *
 * To regenerate these types from your Supabase project:
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Link to your project: supabase link --project-ref <your-project-ref>
 * 3. Generate types: supabase gen types typescript --linked > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// ENUMS
// ============================================================================

export type TransactionType = 'income' | 'expense';

export type InsightType =
  | 'spending_increase'
  | 'budget_recommendation'
  | 'unusual_expense'
  | 'positive_reinforcement';

export type SubscriptionStatus = 'active' | 'unused' | 'dismissed' | 'kept';

export type SubscriptionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual';

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          type: TransactionType;
          is_predefined: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color: string;
          type: TransactionType;
          is_predefined?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          type?: TransactionType;
          is_predefined?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          type: TransactionType;
          date: string; // ISO date string
          notes: string | null;
          currency: string; // ISO 4217 currency code (Story 10-6)
          exchange_rate: number | null; // Rate at time of entry (Story 10-6)
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          type: TransactionType;
          date?: string;
          notes?: string | null;
          currency?: string; // Defaults to 'EUR' (Story 10-6)
          exchange_rate?: number | null; // Story 10-6
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          type?: TransactionType;
          date?: string;
          notes?: string | null;
          currency?: string; // Story 10-6
          exchange_rate?: number | null; // Story 10-6
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          }
        ];
      };
      insights: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          type: InsightType;
          priority: number;
          is_dismissed: boolean;
          metadata: Json | null;
          created_at: string;
          view_count: number;
          first_viewed_at: string | null;
          last_viewed_at: string | null;
          dismissed_at: string | null;
          metadata_expanded_count: number;
          last_metadata_expanded_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description: string;
          type: InsightType;
          priority?: number;
          is_dismissed?: boolean;
          metadata?: Json | null;
          created_at?: string;
          view_count?: number;
          first_viewed_at?: string | null;
          last_viewed_at?: string | null;
          dismissed_at?: string | null;
          metadata_expanded_count?: number;
          last_metadata_expanded_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          type?: InsightType;
          priority?: number;
          is_dismissed?: boolean;
          metadata?: Json | null;
          created_at?: string;
          view_count?: number;
          first_viewed_at?: string | null;
          last_viewed_at?: string | null;
          dismissed_at?: string | null;
          metadata_expanded_count?: number;
          last_metadata_expanded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'insights_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      user_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          profile_picture_url: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          profile_picture_url?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          profile_picture_url?: string | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string;
          event_name: string;
          event_properties: Json;
          timestamp: string;
          session_id: string | null;
          device_type: 'mobile' | 'tablet' | 'desktop' | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_name: string;
          event_properties?: Json;
          timestamp?: string;
          session_id?: string | null;
          device_type?: 'mobile' | 'tablet' | 'desktop' | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_name?: string;
          event_properties?: Json;
          timestamp?: string;
          session_id?: string | null;
          device_type?: 'mobile' | 'tablet' | 'desktop' | null;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_events_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      user_feature_state: {
        Row: {
          user_id: string;
          transactions_count: number;
          days_active: number;
          features_unlocked: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          transactions_count?: number;
          days_active?: number;
          features_unlocked?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          transactions_count?: number;
          days_active?: number;
          features_unlocked?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_feature_state_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      detected_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          merchant_pattern: string;
          estimated_amount: number;
          currency: string;
          frequency: SubscriptionFrequency;
          last_seen_at: string;
          status: SubscriptionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          merchant_pattern: string;
          estimated_amount: number;
          currency?: string;
          frequency: SubscriptionFrequency;
          last_seen_at: string;
          status?: SubscriptionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          merchant_pattern?: string;
          estimated_amount?: number;
          currency?: string;
          frequency?: SubscriptionFrequency;
          last_seen_at?: string;
          status?: SubscriptionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'detected_subscriptions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      user_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_token: string;
          device_name: string;
          device_type: 'mobile' | 'tablet' | 'desktop';
          browser: string | null;
          ip_address: string | null;
          last_active: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_token: string;
          device_name?: string;
          device_type?: 'mobile' | 'tablet' | 'desktop';
          browser?: string | null;
          ip_address?: string | null;
          last_active?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_token?: string;
          device_name?: string;
          device_type?: 'mobile' | 'tablet' | 'desktop';
          browser?: string | null;
          ip_address?: string | null;
          last_active?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_sessions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      seed_user_categories: {
        Args: {
          target_user_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      transaction_type: TransactionType;
      insight_type: InsightType;
      subscription_status: SubscriptionStatus;
      subscription_frequency: SubscriptionFrequency;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ============================================================================
// HELPER TYPES
// ============================================================================

// Type helpers for easier usage
export type Category = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

export type Insight = Database['public']['Tables']['insights']['Row'];
export type InsightInsert = Database['public']['Tables']['insights']['Insert'];
export type InsightUpdate = Database['public']['Tables']['insights']['Update'];

export type UserFeatureState = Database['public']['Tables']['user_feature_state']['Row'];
export type UserFeatureStateInsert = Database['public']['Tables']['user_feature_state']['Insert'];
export type UserFeatureStateUpdate = Database['public']['Tables']['user_feature_state']['Update'];

export type UserSession = Database['public']['Tables']['user_sessions']['Row'];
export type UserSessionInsert = Database['public']['Tables']['user_sessions']['Insert'];
export type UserSessionUpdate = Database['public']['Tables']['user_sessions']['Update'];

export type DetectedSubscription = Database['public']['Tables']['detected_subscriptions']['Row'];
export type DetectedSubscriptionInsert = Database['public']['Tables']['detected_subscriptions']['Insert'];
export type DetectedSubscriptionUpdate = Database['public']['Tables']['detected_subscriptions']['Update'];

// Transaction with category details (for joined queries)
export type TransactionWithCategory = Transaction & {
  categories: Pick<Category, 'name' | 'color' | 'type'>;
};

// ============================================================================
// HEATMAP TYPES (Story 11.3)
// ============================================================================

/** A single day's aggregated spending data for the heatmap */
export interface DailySpendingEntry {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total expense amount for the day, rounded to 2 decimal places */
  total: number;
  /** Number of expense transactions on the day */
  count: number;
}

/** API response shape from GET /api/heatmap */
export interface HeatmapResponse {
  data: DailySpendingEntry[];
  year: number;
  /** Month number (1-12) */
  month: number;
  /** True if user has 7+ distinct days with expense transactions */
  hasEnoughData: boolean;
}

/** Heatmap color intensity level: 0 = no spending, 4 = highest spending */
export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

// ============================================================================
// PROJECTIONS TYPES (Story 11.4)
// ============================================================================

/** A single category's annualized spending projection */
export interface CategoryProjection {
  category_id: string;
  category_name: string;
  category_color: string;
  /** Average monthly spend over analysis window, rounded to 2dp */
  monthly_avg: number;
  /** monthly_avg × 12, rounded to 2dp */
  annual_projection: number;
  /** Total transactions in analysis period */
  transaction_count: number;
  /** True if category matches a detected active/unused subscription */
  is_recurring: boolean;
  /** 'new' = no prior period data */
  trend: 'up' | 'down' | 'stable' | 'new';
  /** % change vs prior period (null if 'new' or prior unavailable) */
  trend_percentage: number | null;
}

/** API response shape from GET /api/dashboard/annualized-projections */
export interface ProjectionsResponse {
  projections: CategoryProjection[];
  /** true when ≥1 complete past month of expense transactions */
  hasEnoughData: boolean;
  /** Number of complete months used (1-3) */
  months_analyzed: number;
}

// Insight metadata type (extend as needed)
// ============================================================================
// GOAL TYPES (Story 11.5)
// ============================================================================

/** A savings goal row from the goals table */
export interface Goal {
  id: string;
  user_id: string;
  name: string;
  /** Target savings amount (> 0) */
  target_amount: number;
  /** Accumulated saved amount from contributions (>= 0) */
  current_amount: number;
  /** Optional target date in YYYY-MM-DD format, or null */
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

/** A single contribution to a savings goal */
export interface GoalContribution {
  id: string;
  goal_id: string;
  user_id: string;
  /** Contribution amount (> 0) */
  amount: number;
  /** Optional note describing the contribution */
  note: string | null;
  created_at: string;
}

/** Input for creating a new goal */
export interface CreateGoalInput {
  name: string;
  target_amount: number;
  /** Optional deadline (YYYY-MM-DD), null = no deadline */
  deadline?: string | null;
}

/** Input for updating an existing goal */
export interface UpdateGoalInput {
  name?: string;
  target_amount?: number;
  /** Pass null to remove deadline */
  deadline?: string | null;
}

/** Input for adding a contribution to a goal */
export interface AddContributionInput {
  /** Amount to add (> 0) */
  amount: number;
  /** Optional note */
  note?: string | null;
}

/** API response shape from GET /api/goals */
export interface GoalsListResponse {
  goals: Goal[];
}

export interface InsightMetadata {
  category_id?: string;
  category_name?: string;
  current_amount?: number;
  previous_amount?: number;
  percent_change?: number;
  transaction_count_current?: number;
  transaction_count_previous?: number;
  current_month?: string;
  previous_month?: string;
  three_month_average?: number;
  recommended_budget?: number;
  calculation_explanation?: string;
  months_analyzed?: string[];
  transaction_amount?: number;
  transaction_date?: string;
  transaction_id?: string;
  category_average?: number;
  standard_deviation?: number;
  std_devs_from_mean?: number;
  budget_amount?: number;
  actual_spending?: number;
  savings_amount?: number;
  percent_under_budget?: number;
  [key: string]: Json | undefined;
}
