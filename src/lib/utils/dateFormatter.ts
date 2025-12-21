/**
 * Story 8.3: Settings Page and Account Management
 * Date Formatting Utilities
 *
 * Formats dates according to user's date format preference
 */

import { format } from 'date-fns';
import type { UserPreferences } from '@/types/user.types';

/**
 * Map user date format preference to date-fns format string
 */
const DATE_FORMAT_MAP: Record<UserPreferences['date_format'], string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
};

/**
 * Map user date format preference to month-day format (for short displays)
 */
const SHORT_DATE_FORMAT_MAP: Record<UserPreferences['date_format'], string> = {
  'MM/DD/YYYY': 'MMM dd, yyyy',
  'DD/MM/YYYY': 'dd MMM yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
};

/**
 * Format a date according to user's date format preference
 *
 * @param date - Date to format (Date object or ISO string)
 * @param dateFormat - User's date format preference
 * @param short - If true, uses short format (MMM dd, yyyy style)
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  dateFormat: UserPreferences['date_format'] = 'MM/DD/YYYY',
  short: boolean = false
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const formatString = short
    ? SHORT_DATE_FORMAT_MAP[dateFormat]
    : DATE_FORMAT_MAP[dateFormat];

  return format(dateObj, formatString);
}

/**
 * Format a date for display in transactions list
 * Uses short format with user's preference
 *
 * @param date - Date to format
 * @param dateFormat - User's date format preference
 * @returns Formatted date string (e.g., "Jan 15, 2025" or "15 Jan 2025")
 */
export function formatTransactionDate(
  date: Date | string,
  dateFormat: UserPreferences['date_format'] = 'MM/DD/YYYY'
): string {
  return formatDate(date, dateFormat, true);
}
