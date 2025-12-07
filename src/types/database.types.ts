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

// Transaction with category details (for joined queries)
export type TransactionWithCategory = Transaction & {
  categories: Pick<Category, 'name' | 'color' | 'type'>;
};

// Insight metadata type (extend as needed)
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
