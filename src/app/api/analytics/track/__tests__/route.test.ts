/**
 * Analytics Track API Route Tests
 * Story 9-4: Add Insight Engagement Analytics (AC-9.4.8)
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/analytics/track/route';
import { createClient } from '@/lib/supabase/server';
import {
  createSupabaseMock,
  type QueryResult,
  type SupabaseMock,
} from '@/test-utils/supabaseChain';

/*
 * MIGRATED 2026-11-18 to `@/test-utils/supabaseChain`. Module-level
 * mockInsert/mockSelect/mockSingle wired into a hand-rolled client become one
 * factory client per test; `eventResult` sets what the analytics_events insert
 * returns, and the insert payload is read off the insert call.
 */
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
let db: SupabaseMock;
function eventResult(result: QueryResult) {
  db = createSupabaseMock({ user: { id: 'user-123' }, tables: { analytics_events: result } });
  (createClient as jest.Mock).mockResolvedValue(db.client);
}

// Helper to create mock request
function createMockRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

describe('POST /api/analytics/track', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user, successful insert
    eventResult({ data: { id: 'event-uuid-123' }, error: null });
  });

  describe('Authentication', () => {
    it('returns 401 if user is not authenticated', async () => {
      db.client.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const request = createMockRequest({
        event_name: 'insights_page_viewed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 if auth error occurs', async () => {
      db.client.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Auth error' },
      });

      const request = createMockRequest({
        event_name: 'insights_page_viewed',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const request = {
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });

    it('returns 400 if event_name is missing', async () => {
      const request = createMockRequest({
        event_properties: { filter: 'all' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('event_name');
    });

    it('returns 400 if event_name is invalid', async () => {
      const request = createMockRequest({
        event_name: 'invalid_event',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid event_name');
    });

    it('returns 400 if device_type is invalid', async () => {
      const request = createMockRequest({
        event_name: 'insights_page_viewed',
        device_type: 'smartwatch',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('device_type');
    });

    it('accepts valid event_name values', async () => {
      const validEvents = ['insights_page_viewed', 'insight_viewed', 'insight_dismissed'];

      for (const eventName of validEvents) {
        eventResult({
          data: { id: 'event-uuid' },
          error: null,
        });

        const request = createMockRequest({ event_name: eventName });
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    });
  });

  describe('Successful tracking', () => {
    it('returns 201 with event_id on success', async () => {
      const request = createMockRequest({
        event_name: 'insights_page_viewed',
        event_properties: { filter: 'spending' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.event_id).toBe('event-uuid-123');
    });

    it('passes correct data to Supabase insert', async () => {
      const request = createMockRequest({
        event_name: 'insight_viewed',
        event_properties: { insight_id: 'abc', insight_type: 'spending' },
        session_id: 'session-123',
        device_type: 'mobile',
      });

      await POST(request);

      expect(db.callsTo('analytics_events', 'insert')).toContainEqual([
        {
          user_id: 'user-123',
          event_name: 'insight_viewed',
          event_properties: { insight_id: 'abc', insight_type: 'spending' },
          session_id: 'session-123',
          device_type: 'mobile',
        },
      ]);
    });

    it('handles optional fields with defaults', async () => {
      const request = createMockRequest({
        event_name: 'insights_page_viewed',
      });

      await POST(request);

      expect(db.callsTo('analytics_events', 'insert')).toContainEqual([
        {
          user_id: 'user-123',
          event_name: 'insights_page_viewed',
          event_properties: {},
          session_id: null,
          device_type: null,
        },
      ]);
    });
  });

  describe('Database errors', () => {
    it('returns 500 on database insert error', async () => {
      eventResult({
        data: null,
        error: { message: 'Database error' },
      });

      const request = createMockRequest({
        event_name: 'insights_page_viewed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to store event');
    });
  });
});

describe('GET /api/analytics/track', () => {
  it('returns 405 Method Not Allowed', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(405);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Method not allowed');
  });
});
