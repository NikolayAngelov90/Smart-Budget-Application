/**
 * Values Service
 * Story 14.1: Values-Based Spending Plan
 *
 * CRUD for a user's personal values + their category mappings. Purely personal — every
 * call uses the AUTH-SCOPED client so the owner-only RLS (migration 031) is the security
 * boundary and is exercised in production (no service-role).
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { ValueWithCategories, CreateValueInput, UpdateValueInput } from '@/types/database.types';

const NAME_MAX = 50;

function validName(name: string): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
    throw new Error('Value name must be 1–50 characters');
  }
  return trimmed;
}

/** Returns the user's values (priority ASC), each with its mapped category ids. */
export async function getValuesPlan(userId: string): Promise<ValueWithCategories[]> {
  const supabase = await createClient();

  const { data: values, error } = await supabase
    .from('user_values')
    .select('id, name, priority')
    .eq('user_id', userId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    logger.error('ValuesService', `list values failed: ${error.message}`);
    throw new Error('Failed to load values');
  }
  const valueRows = values ?? [];
  if (valueRows.length === 0) return [];

  const { data: maps, error: mapError } = await supabase
    .from('value_categories')
    .select('value_id, category_id')
    .eq('user_id', userId);
  if (mapError) {
    logger.error('ValuesService', `list value_categories failed: ${mapError.message}`);
    throw new Error('Failed to load value categories');
  }

  const byValue = new Map<string, string[]>();
  for (const m of maps ?? []) {
    const list = byValue.get(m.value_id) ?? [];
    list.push(m.category_id);
    byValue.set(m.value_id, list);
  }

  return valueRows.map((v) => ({
    id: v.id,
    name: v.name,
    priority: v.priority,
    category_ids: byValue.get(v.id) ?? [],
  }));
}

/** Creates a value (appended at the end of the priority order) + optional category mappings. */
export async function createValue(userId: string, input: CreateValueInput): Promise<ValueWithCategories> {
  const name = validName(input.name);
  const supabase = await createClient();

  // Next priority = current max + 1.
  const { data: existing } = await supabase
    .from('user_values')
    .select('priority')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPriority = (existing?.priority ?? -1) + 1;

  const { data: value, error } = await supabase
    .from('user_values')
    .insert({ user_id: userId, name, priority: nextPriority })
    .select('id, name, priority')
    .single();
  if (error || !value) {
    if (error?.code === '23505') throw new Error('A value with that name already exists');
    logger.error('ValuesService', `create value failed: ${error?.message}`);
    throw new Error('Failed to create value');
  }

  const categoryIds = input.categoryIds ?? [];
  const stored = categoryIds.length > 0 ? await replaceValueCategories(userId, value.id, categoryIds) : [];

  return { id: value.id, name: value.name, priority: value.priority, category_ids: stored };
}

/** Updates a value's name and/or priority (owner-scoped). */
export async function updateValue(userId: string, valueId: string, input: UpdateValueInput): Promise<void> {
  const updates: { name?: string; priority?: number } = {};
  if (input.name !== undefined) updates.name = validName(input.name);
  if (input.priority !== undefined) updates.priority = input.priority;
  if (Object.keys(updates).length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from('user_values').update(updates).eq('id', valueId).eq('user_id', userId);
  if (error) {
    if (error.code === '23505') throw new Error('A value with that name already exists');
    logger.error('ValuesService', `update value failed: ${error.message}`);
    throw new Error('Failed to update value');
  }
}

/** Replaces the set of categories mapped to a value. */
export async function setValueCategories(userId: string, valueId: string, categoryIds: string[]): Promise<void> {
  const supabase = await createClient();
  // Confirm the value is the caller's (RLS would also block, but a clean 404 is nicer).
  const { data: value } = await supabase
    .from('user_values')
    .select('id')
    .eq('id', valueId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!value) throw new Error('Value not found');
  await replaceValueCategories(userId, valueId, categoryIds);
}

/** Internal: delete existing mappings for a value, then insert the new (visible) set. Returns the ids stored. */
async function replaceValueCategories(userId: string, valueId: string, categoryIds: string[]): Promise<string[]> {
  const supabase = await createClient();
  const { error: delError } = await supabase
    .from('value_categories')
    .delete()
    .eq('user_id', userId)
    .eq('value_id', valueId);
  if (delError) {
    logger.error('ValuesService', `clear value categories failed: ${delError.message}`);
    throw new Error('Failed to update value categories');
  }

  const unique = Array.from(new Set(categoryIds));
  if (unique.length === 0) return [];

  // Keep only categories the caller can actually see (RLS-scoped). Drops arbitrary or
  // invisible ids so a value can never reference a category the user doesn't own/share.
  const { data: visible, error: catError } = await supabase
    .from('categories')
    .select('id')
    .in('id', unique);
  if (catError) {
    logger.error('ValuesService', `validate categories failed: ${catError.message}`);
    throw new Error('Failed to update value categories');
  }
  const allowed = (visible ?? []).map((c) => c.id);
  if (allowed.length === 0) return [];

  const rows = allowed.map((category_id) => ({ user_id: userId, value_id: valueId, category_id }));
  const { error: insError } = await supabase.from('value_categories').insert(rows);
  if (insError) {
    logger.error('ValuesService', `insert value categories failed: ${insError.message}`);
    throw new Error('Failed to update value categories');
  }
  return allowed;
}

/** Deletes a value (cascade removes its mappings). */
export async function deleteValue(userId: string, valueId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('user_values').delete().eq('id', valueId).eq('user_id', userId);
  if (error) {
    logger.error('ValuesService', `delete value failed: ${error.message}`);
    throw new Error('Failed to delete value');
  }
}

/** Rewrites priority to the array index for each value id (own rows only). */
export async function reorderValues(userId: string, orderedIds: string[]): Promise<void> {
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    const { error } = await supabase
      .from('user_values')
      .update({ priority: i })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      logger.error('ValuesService', `reorder failed at ${id}: ${error.message}`);
      throw new Error('Failed to reorder values');
    }
  }
}
