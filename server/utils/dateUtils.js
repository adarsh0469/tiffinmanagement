/**
 * Centralized local date utilities for Tiffin Centre Management System.
 * Ensures consistent YYYY-MM-DD formatting without UTC timezone shifts.
 */

// Format Date object to YYYY-MM-DD in local time
export const formatDateLocal = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Parse YYYY-MM-DD string into local midnight Date object
export const parseLocalDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return new Date();
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 0, 0, 0, 0);
};

// Get today's date in YYYY-MM-DD local format
export const getTodayStr = () => {
  return formatDateLocal(new Date());
};

// Get current month in YYYY-MM local format
export const getCurrentMonthStr = () => {
  return getTodayStr().slice(0, 7);
};

// Get number of days in month. Supports both getDaysInMonth("2026-09") and getDaysInMonth(2026, 9)
export const getDaysInMonth = (yearOrMonthStr, monthNum) => {
  if (typeof yearOrMonthStr === 'string' && yearOrMonthStr.includes('-')) {
    const parts = yearOrMonthStr.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return new Date(y, m, 0).getDate();
  }
  const y = parseInt(yearOrMonthStr, 10);
  const m = parseInt(monthNum, 10);
  return new Date(y, m, 0).getDate();
};

// Helper for short day name (e.g. Mon, Tue)
export const getDayName = (dateStr) => {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

/**
 * Robust 1-Month Cycle Adder handling month boundaries and leap years.
 * Test Cases Handled:
 * 30 Jan -> 28/29 Feb
 * 31 Jan -> 28/29 Feb
 * 31 Mar -> 30 Apr
 * 29 Feb (leap year) -> 29 Mar
 */
export const addOneMonthCycle = (startDateStr) => {
  if (!startDateStr) return getTodayStr();
  const [sYear, sMonth, sDay] = startDateStr.split('T')[0].split('-').map(Number);
  
  let targetYear = sYear;
  let targetMonth = sMonth + 1; // Move to next month
  
  if (targetMonth > 12) {
    targetYear += 1;
    targetMonth = 1;
  }

  const maxDaysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(sDay, maxDaysInTargetMonth);

  const mStr = String(targetMonth).padStart(2, '0');
  const dStr = String(targetDay).padStart(2, '0');
  
  return `${targetYear}-${mStr}-${dStr}`;
};

// Check if a target date string falls within [fromDate, toDate] inclusive
export const isDateInRange = (targetDateStr, fromDateStr, toDateStr) => {
  if (!targetDateStr || !fromDateStr || !toDateStr) return false;
  return targetDateStr >= fromDateStr && targetDateStr <= toDateStr;
};
