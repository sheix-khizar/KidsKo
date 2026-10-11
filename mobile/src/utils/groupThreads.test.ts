import { groupThreadsByDate } from './groupThreads';
import { ThreadSummary } from '../services/threads';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`✅ PASS: ${msg}`);
}

function runTests() {
  console.log('🧪 Testing groupThreadsByDate with explicit calendar reference dates...');

  // Set fixed "now" as Oct 12, 2026 at 14:00 local time
  const refNow = new Date(2026, 9, 12, 14, 0, 0);

  const mockThreads: ThreadSummary[] = [
    // Today: Oct 12, 2026 at 09:00
    { id: '1', title: 'Today Thread', updatedAt: new Date(2026, 9, 12, 9, 0, 0).toISOString() },
    // Yesterday: Oct 11, 2026 at 20:00 (18 hours ago)
    { id: '2', title: 'Yesterday Evening Thread', updatedAt: new Date(2026, 9, 11, 20, 0, 0).toISOString() },
    // Yesterday: Oct 11, 2026 at 01:00 (37 hours ago, but still yesterday calendar day!)
    { id: '3', title: 'Yesterday Morning Thread', updatedAt: new Date(2026, 9, 11, 1, 0, 0).toISOString() },
    // Previous 7 Days: Oct 8, 2026
    { id: '4', title: '4 Days Ago Thread', updatedAt: new Date(2026, 9, 8, 12, 0, 0).toISOString() },
    // Older: Sep 20, 2026
    { id: '5', title: 'Old Thread', updatedAt: new Date(2026, 8, 20, 12, 0, 0).toISOString() },
  ];

  const sections = groupThreadsByDate(mockThreads, refNow);

  assert(sections.length === 4, 'Has 4 sections');
  assert(sections[0].title === 'Today' && sections[0].data.length === 1, 'Today section has 1 thread');
  assert(sections[1].title === 'Yesterday' && sections[1].data.length === 2, 'Yesterday section has both threads (18h ago and 37h ago)');
  assert(sections[2].title === 'Previous 7 Days' && sections[2].data.length === 1, 'Previous 7 Days has 1 thread');
  assert(sections[3].title === 'Older' && sections[3].data.length === 1, 'Older section has 1 thread');

  console.log('🎉 All groupThreadsByDate calendar grouping tests passed cleanly!');
}

runTests();
