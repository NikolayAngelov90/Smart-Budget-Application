/**
 * Centralized Realtime Subscription Manager
 * Story 7.3: Code Quality Improvements
 *
 * Manages a single Supabase Realtime subscription for transaction changes,
 * broadcasting events to multiple listeners. Reduces connection overhead
 * from 5 separate subscriptions to 1.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * Realtime event types
 */
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Realtime event payload
 */
export interface RealtimeEvent {
  eventType: RealtimeEventType;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  timestamp: string;
}

/**
 * Listener callback function type
 */
export type RealtimeListener = (event: RealtimeEvent) => void;

/**
 * Centralized subscription manager using Singleton + Event Emitter pattern
 */
class RealtimeSubscriptionManager extends EventTarget {
  private static instance: RealtimeSubscriptionManager | null = null;
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private listeners = new Set<RealtimeListener>();
  private isSubscribed = false;

  private constructor() {
    super();
    this.supabase = createClient();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): RealtimeSubscriptionManager {
    if (!RealtimeSubscriptionManager.instance) {
      RealtimeSubscriptionManager.instance = new RealtimeSubscriptionManager();
    }
    return RealtimeSubscriptionManager.instance;
  }

  /**
   * Subscribe to transaction changes
   * Lazily initializes the Realtime channel on first subscriber
   */
  private async initializeChannel(): Promise<void> {
    if (this.channel || this.isSubscribed) {
      return; // Already initialized
    }

    console.log('[RealtimeManager] Initializing Realtime channel');

    this.channel = this.supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('[RealtimeManager] Received event:', payload.eventType);

          // Create event object
          const event: RealtimeEvent = {
            eventType: payload.eventType as RealtimeEventType,
            new: payload.new as Record<string, unknown> | null,
            old: payload.old as Record<string, unknown> | null,
            timestamp: new Date().toISOString(),
          };

          // Broadcast to all listeners
          this.broadcast(event);
        }
      )
      .subscribe((status) => {
        console.log('[RealtimeManager] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
        }
      });
  }

  /**
   * Broadcast event to all registered listeners
   */
  private broadcast(event: RealtimeEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[RealtimeManager] Error in listener:', error);
      }
    });
  }

  /**
   * Add a listener for transaction change events
   * Automatically initializes channel on first listener
   */
  public addListener(listener: RealtimeListener): void {
    console.log('[RealtimeManager] Adding listener. Total:', this.listeners.size + 1);
    this.listeners.add(listener);

    // Initialize channel if this is the first listener
    if (this.listeners.size === 1) {
      this.initializeChannel();
    }
  }

  /**
   * Remove a listener
   * Closes channel when no more listeners remain
   */
  public removeListener(listener: RealtimeListener): void {
    this.listeners.delete(listener);
    console.log('[RealtimeManager] Removed listener. Remaining:', this.listeners.size);

    // Close channel if no more listeners
    if (this.listeners.size === 0) {
      this.closeChannel();
    }
  }

  /**
   * Close the Realtime channel
   */
  private closeChannel(): void {
    if (this.channel) {
      console.log('[RealtimeManager] Closing Realtime channel (no active listeners)');
      this.supabase.removeChannel(this.channel);
      this.channel = null;
      this.isSubscribed = false;
    }
  }

  /**
   * Get the number of active listeners (for debugging)
   */
  public getListenerCount(): number {
    return this.listeners.size;
  }
}

// Export singleton instance
export const realtimeManager = RealtimeSubscriptionManager.getInstance();
