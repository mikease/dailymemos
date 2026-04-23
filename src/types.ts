/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Goal {
  id: string;
  text: string;
  description?: string; // Content describing task completion
  progress: number; // 0 to 100
  images?: string[]; // Array of base64 or URL strings
}

export interface DayEntry {
  id: string;
  date: Date;
  theme?: string; // Daily theme/focus
  status: 'productive' | 'neutral' | 'unproductive' | 'rest';
  goals: Goal[];
  note?: string;
}
