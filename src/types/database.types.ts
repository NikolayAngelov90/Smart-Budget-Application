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
  | 'positive_reinforcement'
  | 'spending_anomaly'
  | 'new_high_spend_category';

export type SubscriptionStatus = 'active' | 'unused' | 'dismissed' | 'kept';

export type SubscriptionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type HouseholdRole = 'admin' | 'member'; // Story 13.1

export type InvitationStatus = 'pending' | 'accepted' | 'revoked'; // Story 13.2

export type VisibilityLevel = 'shared' | 'category_only' | 'private'; // Story 13.4
export type HouseholdPreset = 'newlyweds' | 'roommates' | 'partners' | 'custom'; // Story 13.4

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
          household_id: string | null; // Story 13.5 (shared category when set)
          visibility_level: VisibilityLevel; // Story 13.4
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color: string;
          type: TransactionType;
          is_predefined?: boolean;
          household_id?: string | null; // Story 13.5
          visibility_level?: VisibilityLevel; // Story 13.4
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          type?: TransactionType;
          is_predefined?: boolean;
          household_id?: string | null; // Story 13.5
          visibility_level?: VisibilityLevel; // Story 13.4
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
          household_id: string | null; // Story 13.5 (shared-category transaction when set)
          allowance_id: string | null; // Story 13.6 (private allowance spending when set)
          goal_contribution_id: string | null; // Story 13.9 (Savings expense from a goal contribution)
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
          household_id?: string | null; // Story 13.5
          allowance_id?: string | null; // Story 13.6
          goal_contribution_id?: string | null; // Story 13.9
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
          household_id?: string | null; // Story 13.5
          allowance_id?: string | null; // Story 13.6
          goal_contribution_id?: string | null; // Story 13.9
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
          analytics_viewer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          profile_picture_url?: string | null;
          preferences?: Json;
          analytics_viewer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          profile_picture_url?: string | null;
          preferences?: Json;
          analytics_viewer?: boolean;
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
      weekly_digests: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          week_end: string;
          total_spending: number;
          previous_week_spending: number;
          spending_change_pct: number;
          top_categories: Json;
          actionable_highlight: string;
          currency: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          week_end: string;
          total_spending: number;
          previous_week_spending: number;
          spending_change_pct: number;
          top_categories?: Json;
          actionable_highlight?: string;
          currency?: string;
          generated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          week_end?: string;
          total_spending?: number;
          previous_week_spending?: number;
          spending_change_pct?: number;
          top_categories?: Json;
          actionable_highlight?: string;
          currency?: string;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weekly_digests_user_id_fkey';
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
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      recovery_plans: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          end_date: string;
          status: RecoveryPlanStatus;
          targets: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          end_date: string;
          status?: RecoveryPlanStatus;
          targets: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_date?: string;
          end_date?: string;
          status?: RecoveryPlanStatus;
          targets?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recovery_plans_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      // Story 13.1: Household Collaboration foundation
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'households_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          preset: HouseholdPreset | null; // Story 13.4
          contribution_percentage: number | null; // Story 13.7
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          preset?: HouseholdPreset | null; // Story 13.4
          contribution_percentage?: number | null; // Story 13.7
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: HouseholdRole;
          preset?: HouseholdPreset | null; // Story 13.4
          contribution_percentage?: number | null; // Story 13.7
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      // Story 13.2: Household invitations
      household_invitations: {
        Row: {
          id: string;
          household_id: string;
          email: string;
          token: string;
          status: InvitationStatus;
          invited_by: string | null;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          email: string;
          token?: string;
          status?: InvitationStatus;
          invited_by?: string | null;
          expires_at: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          email?: string;
          token?: string;
          status?: InvitationStatus;
          invited_by?: string | null;
          expires_at?: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_invitations_household_id_fkey';
            columns: ['household_id'];
            referencedRelation: 'households';
            referencedColumns: ['id'];
          }
        ];
      };
      // Story 13.6: Personal allowances (private budget within a household — owner-only RLS)
      personal_allowances: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          monthly_amount: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          monthly_amount?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          household_id?: string;
          monthly_amount?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_allowances_household_id_fkey';
            columns: ['household_id'];
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_allowances_user_id_fkey';
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
      // Story 13.4: aggregate totals for shared + category_only categories (private excluded)
      household_category_totals: {
        Args: {
          p_household_id: string;
        };
        Returns: {
          category_id: string;
          category_name: string;
          visibility_level: VisibilityLevel;
          total: number;
        }[];
      };
      // Story 13.7: per-member percentage + contributed total (sums, never rows)
      household_contributions: {
        Args: {
          p_household_id: string;
        };
        Returns: {
          user_id: string;
          email: string;
          contribution_percentage: number | null;
          contributed: number;
        }[];
      };
      // Story 13.2 follow-up: resolve an email to its auth.users id (service-role only)
      user_id_by_email: {
        Args: {
          p_email: string;
        };
        Returns: string | null;
      };
      // Story 13.9: per-member contributed totals for a shared goal (sums, never rows)
      household_goal_breakdown: {
        Args: {
          p_goal_id: string;
        };
        Returns: {
          user_id: string;
          email: string;
          contributed: number;
        }[];
      };
      // Story 13.10 / 13.8: date-bounded shared-category totals (private excluded; sums only)
      household_category_period_totals: {
        Args: {
          p_household_id: string;
          p_start: string;
          p_end: string;
        };
        Returns: {
          category_id: string;
          category_name: string;
          visibility_level: VisibilityLevel;
          total: number;
        }[];
      };
      // Story 13.11: membership-gated member roster (for the admin management UI)
      household_members_list: {
        Args: {
          p_household_id: string;
        };
        Returns: {
          user_id: string;
          email: string;
          role: HouseholdRole;
          joined_at: string;
        }[];
      };
    };
    Enums: {
      transaction_type: TransactionType;
      insight_type: InsightType;
      subscription_status: SubscriptionStatus;
      subscription_frequency: SubscriptionFrequency;
      household_role: HouseholdRole;
      invitation_status: InvitationStatus;
      visibility_level: VisibilityLevel;
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

// Story 13.1: Household Collaboration
export type Household = Database['public']['Tables']['households']['Row'];
export type HouseholdInsert = Database['public']['Tables']['households']['Insert'];
export type HouseholdUpdate = Database['public']['Tables']['households']['Update'];

export type HouseholdMember = Database['public']['Tables']['household_members']['Row'];
export type HouseholdMemberInsert = Database['public']['Tables']['household_members']['Insert'];
export type HouseholdMemberUpdate = Database['public']['Tables']['household_members']['Update'];

/** A household plus the requesting user's role + their chosen transparency preset. */
export type HouseholdWithRole = Household & { role: HouseholdRole; preset?: HouseholdPreset | null };

// Story 13.2: Household invitations
export type HouseholdInvitation = Database['public']['Tables']['household_invitations']['Row'];
export type HouseholdInvitationInsert = Database['public']['Tables']['household_invitations']['Insert'];
export type HouseholdInvitationUpdate = Database['public']['Tables']['household_invitations']['Update'];

/** An invitation enriched for display: expiry computed, optional shareable accept link. */
export type HouseholdInvitationWithState = HouseholdInvitation & {
  isExpired: boolean;
  acceptLink?: string;
};

/** A pending invitation addressed to the current user (for the in-app accept banner). */
export interface MyInvitation {
  id: string;
  token: string;
  householdName: string;
}

// Story 13.4: aggregate result from household_category_totals() (sums, never rows)
export interface HouseholdCategoryTotal {
  category_id: string;
  category_name: string;
  visibility_level: VisibilityLevel;
  total: number;
}

// Story 13.6: Personal allowance (private budget within a household)
export type PersonalAllowance = Database['public']['Tables']['personal_allowances']['Row'];
export type PersonalAllowanceInsert = Database['public']['Tables']['personal_allowances']['Insert'];
export type PersonalAllowanceUpdate = Database['public']['Tables']['personal_allowances']['Update'];

/** Allowance plus the current-period spend and remaining balance (owner-only view). */
export interface AllowanceStatus {
  allowance: PersonalAllowance | null;
  /** Sum of the current month's expense transactions tagged to the allowance. */
  spent: number;
  /** monthly_amount - spent, or null when no allowance is configured. */
  remaining: number | null;
}

// Story 13.7: Income-proportional contribution splits
/** Raw row returned by the household_contributions() RPC (sums, never rows). */
export interface HouseholdContributionRow {
  user_id: string;
  email: string;
  contribution_percentage: number | null;
  contributed: number;
}

/** A member's computed split: fair share of the shared pot + contribution progress. */
export interface ContributionSplit {
  user_id: string;
  email: string;
  percentage: number | null;
  contributed: number;
  /** Normalized share of the total shared pot derived from percentages. */
  fairShare: number;
  /** contributed / fairShare (0 when fairShare is 0); not clamped. */
  progress: number;
  /** True for the requesting user's own row. */
  isSelf: boolean;
}

export interface ContributionSummary {
  /** Total shared-expense pot (Σ contributed across members). */
  total: number;
  splits: ContributionSplit[];
}

// Story 13.9: Shared household savings goals
/** A goal that belongs to a household (shared). */
export type HouseholdGoal = Goal & { household_id: string };

/** Per-member contributed total to a shared goal (from household_goal_breakdown RPC). */
export interface GoalMemberBreakdown {
  user_id: string;
  email: string;
  contributed: number;
}

/** A shared goal plus its per-member breakdown for display. */
export interface HouseholdGoalWithBreakdown {
  goal: HouseholdGoal;
  breakdown: GoalMemberBreakdown[];
}

/** Input for creating a shared household goal. */
export interface CreateHouseholdGoalInput {
  name: string;
  target_amount: number;
  deadline?: string | null;
}

// Story 13.11: Member removal & access revocation
/** A household member roster entry (from household_members_list), enriched with isSelf. */
export interface HouseholdMemberListEntry {
  user_id: string;
  email: string;
  role: HouseholdRole;
  joined_at: string;
  /** True for the requesting user's own row (can't be removed via the UI). */
  isSelf: boolean;
}

// Story 13.10: Household-level AI insights
/** Per-category aggregate total for a date window (from household_category_period_totals). */
export interface HouseholdPeriodTotal {
  category_id: string;
  category_name: string;
  total: number;
}

/** A generated household insight (computed on-demand; not persisted). */
export interface HouseholdInsight {
  type: 'household_category_change' | 'household_spend_change';
  title: string;
  description: string;
  metadata: {
    category_id?: string;
    category_name?: string;
    current_amount?: number;
    previous_amount?: number;
    percent_change?: number;
  };
}

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

// ============================================================================
// FORECAST TYPES (Story 12.2)
// ============================================================================

/** End-of-month spending forecast for a single category */
export interface CategoryForecast {
  category_id: string;
  category_name: string;
  category_color: string;
  /** Current month expense total to date */
  spent_so_far: number;
  /** Extrapolated end-of-month total based on daily rate */
  projected_eom: number;
  /** 3-month rolling average monthly spend (0 if no history) */
  historical_avg: number;
  /** true when projected_eom > historical_avg and historical_avg > 0 */
  is_at_risk: boolean;
  /** Days from 1st of month to today (inclusive) */
  days_elapsed: number;
  /** Total calendar days in current month */
  days_in_month: number;
}

/** API response shape from GET /api/dashboard/budget-forecast */
export interface ForecastResponse {
  forecasts: CategoryForecast[];
  /** false when user has no current-month expense transactions */
  hasCurrentMonthData: boolean;
  /** ISO date string of when the forecast was computed */
  generated_at: string;
}

// ============================================================================
// RECOVERY PLAN TYPES (Story 12.4 / FR4)
// ============================================================================

export type RecoveryPlanStatus = 'active' | 'completed' | 'abandoned';

/** A single category's recovery target within a 30-day plan */
export interface RecoveryTarget {
  category_id: string;
  category_name: string;
  category_color: string;
  /** 3-month average monthly spend (the overspend threshold / budget proxy) */
  historical_avg: number;
  /** Leanest historical month — the realistic floor used as the target */
  historical_min: number;
  /** Monthly recovery target (= historical_min), rounded 2dp */
  monthly_target: number;
  /** monthly_target / (30/7), rounded 2dp */
  weekly_target: number;
  /** monthly_target / 30, rounded 2dp */
  daily_target: number;
  /** Spend in this category since plan start — filled at read time (0 at generation) */
  current_spend: number;
}

/** A persisted 30-day recovery plan */
export interface RecoveryPlan {
  id: string;
  user_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD (start + 30 days)
  status: RecoveryPlanStatus;
  targets: RecoveryTarget[];
  created_at: string;
  updated_at: string;
}

/** A recovery target augmented with computed progress */
export type RecoveryTargetProgress = RecoveryTarget & {
  /** current_spend <= pro-rated target for days elapsed */
  on_track: boolean;
  /** current_spend / monthly_target * 100, rounded */
  pct_of_target: number;
};

/** An active plan plus computed progress for display */
export interface RecoveryPlanProgress {
  plan: RecoveryPlan;
  days_elapsed: number;
  days_remaining: number;
  categories: RecoveryTargetProgress[];
}

/** API response shape from GET /api/recovery-plan */
export interface RecoveryPlanResponse {
  /** Active plan with progress, or null when none active */
  plan: RecoveryPlanProgress | null;
  /** true when the user has overspent categories and a plan can be generated */
  canGenerate: boolean;
}

// ============================================================================
// SEASONAL AWARENESS TYPES (Story 12.5 / FR6)
// ============================================================================

/** A single upcoming month in the seasonal outlook timeline */
export interface SeasonalMonth {
  month: string; // 'YYYY-MM' upcoming month
  month_label: string; // 'YYYY-MM' (UI localizes the display)
  month_index: number; // 1-12 calendar month
  /** Predicted spend from the same month-of-year in history (0 if none) */
  predicted_amount: number;
  /** predicted_amount >= baseline_monthly * 1.25 */
  is_seasonal_high: boolean;
  /** 'YYYY-MM' the prediction was drawn from, or null */
  historical_basis: string | null;
}

/** API response shape from GET /api/dashboard/seasonal */
export interface SeasonalAwarenessResponse {
  /** Next 6 months of predicted spend */
  timeline: SeasonalMonth[];
  /** Average monthly expense across analyzed history, rounded 2dp */
  baseline_monthly: number;
  /** Distinct historical months analyzed */
  months_analyzed: number;
  /** true when >= 6 distinct months of history */
  hasEnoughData: boolean;
  /** ISO timestamp of when the analysis ran */
  generated_at: string;
}

// ============================================================================
// RE-ENGAGEMENT TYPES (Story 12.6 / FR8)
// ============================================================================

export interface ReengagementGoalSummary {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
  pct: number; // 0-100, rounded
}

export interface ReengagementSummary {
  /** Days since the user's last logging activity */
  lapsed_days: number;
  last_active_date: string; // YYYY-MM-DD
  /** Baseline monthly spend from history, 2dp */
  typical_monthly_spend: number;
  active_subscription_count: number;
  /** Active subscriptions normalized to a monthly total, 2dp */
  active_subscription_monthly_total: number;
  goals: ReengagementGoalSummary[];
  /** Coaching-tone, rule-based next step */
  recommended_action: string;
}

/** API response shape from GET /api/reengagement */
export interface ReengagementResponse {
  /** null when the user is active, brand-new, or has dismissed this lapse */
  summary: ReengagementSummary | null;
}

// ============================================================================
// ENGAGEMENT ANALYTICS TYPES (Story 12.8)
// ============================================================================

export type AnalyticsRange = 7 | 30 | 90;

export interface InsightEngagementPoint {
  insight_type: string;
  views: number;
  dismissals: number;
}

export interface ExportUsage {
  csv_count: number;
  pdf_count: number;
  csv_total_transactions: number;
  pdf_total_pages: number;
}

export interface PwaInstallsByPlatform {
  platform: string;
  count: number;
}

export interface WauPoint {
  week_start: string; // 'YYYY-MM-DD' (Monday)
  active_users: number;
}

export interface AnalyticsDashboardData {
  range_days: number;
  insight_engagement: InsightEngagementPoint[];
  export_usage: ExportUsage;
  pwa_installs_by_platform: PwaInstallsByPlatform[];
  pwa_installs_total: number;
  wau_trend: WauPoint[];
  total_events: number;
  generated_at: string;
}

export interface AnalyticsDashboardResponse {
  data: AnalyticsDashboardData;
}

// ============================================================================
// NUDGE TYPES (Story 12.3)
// ============================================================================

export type NudgeSeverity = 'approaching' | 'exceeded';

export interface NudgePayload {
  categoryId: string;
  categoryName: string;
  severity: NudgeSeverity;
  /** Current month total AFTER the triggering transaction */
  currentMonthTotal: number;
  /** 3-month historical average monthly spend for this category */
  historicalAvg: number;
  /** Percentage of historical avg (e.g., 85 means 85%) */
  pctOfAvg: number;
  /** Name of affected goal if one exists, otherwise null */
  affectedGoalName: string | null;
  title: string;
  body: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
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
  /** Milestone thresholds (25, 50, 75, 100) that have been celebrated. Prevents re-triggering. */
  milestones_celebrated: number[];
  /** Story 13.9: set => shared household goal (visible to members); null => personal. */
  household_id?: string | null;
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
  // Pattern detection fields (Story 12.1)
  two_month_average?: number;
  percent_above_baseline?: number;
  [key: string]: Json | undefined;
}

// ============================================================================
// WEEKLY DIGEST — Story 11.7
// ============================================================================

export interface DigestTopCategory {
  category_id: string;
  name: string;
  color: string;
  total: number;
}

export interface WeeklyDigest {
  id: string;
  user_id: string;
  week_start: string;             // ISO date 'YYYY-MM-DD' (Monday)
  week_end: string;               // ISO date 'YYYY-MM-DD' (Sunday)
  total_spending: number;
  previous_week_spending: number;
  spending_change_pct: number;    // negative = decrease, positive = increase
  top_categories: DigestTopCategory[];
  actionable_highlight: string;
  currency: string;
  generated_at: string;
}
