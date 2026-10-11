// mobile/src/utils/groupThreads.ts
// Date grouping helper for chat history drawer

import { ThreadSummary } from '../services/threads';

export type ThreadGroupKey = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

export type GroupedThreadsSection = {
  title: ThreadGroupKey;
  data: ThreadSummary[];
};

/**
 * Groups chat threads by local calendar day into:
 * - Today
 * - Yesterday
 * - Previous 7 Days
 * - Older
 */
export function groupThreadsByDate(
  threads: ThreadSummary[],
  now: Date = new Date()
): GroupedThreadsSection[] {
  // Midnight of current local day
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfPrevious7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const todayList: ThreadSummary[] = [];
  const yesterdayList: ThreadSummary[] = [];
  const prev7DaysList: ThreadSummary[] = [];
  const olderList: ThreadSummary[] = [];

  for (const thread of threads) {
    const threadTime = new Date(thread.updatedAt).getTime();

    if (threadTime >= startOfToday) {
      todayList.push(thread);
    } else if (threadTime >= startOfYesterday) {
      yesterdayList.push(thread);
    } else if (threadTime >= startOfPrevious7Days) {
      prev7DaysList.push(thread);
    } else {
      olderList.push(thread);
    }
  }

  const sections: GroupedThreadsSection[] = [];

  if (todayList.length > 0) {
    sections.push({ title: 'Today', data: todayList });
  }
  if (yesterdayList.length > 0) {
    sections.push({ title: 'Yesterday', data: yesterdayList });
  }
  if (prev7DaysList.length > 0) {
    sections.push({ title: 'Previous 7 Days', data: prev7DaysList });
  }
  if (olderList.length > 0) {
    sections.push({ title: 'Older', data: olderList });
  }

  return sections;
}
