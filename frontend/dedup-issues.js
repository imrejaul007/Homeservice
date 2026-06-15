import fs from 'fs';
import path from 'path';

const journalPath = 'C:/Users/user/.claude/projects/C--Users-user-OneDrive-Desktop-rez-v5-Homeservice/643a03f4-3e14-4621-ae6b-f2de3f7534b6/subagents/workflows/wf_e0052763-7fa/journal.jsonl';

const lines = fs.readFileSync(journalPath, 'utf8').split('\n').filter(Boolean);
const results = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(r => r && r.type === 'result');
const all = results.flatMap(r => (r.result?.issues || []).map(i => ({ ...i, agentId: r.agentId })));

// Normalize file paths
const normalizeFile = (f) => {
  if (!f) return 'unknown';
  const parts = f.replace(/\\/g, '/').split('/');
  return parts.slice(-2).join('/');
};

all.forEach(i => { i._file = normalizeFile(i.file); });

// Group by file
const byFile = {};
all.forEach(i => {
  if (!byFile[i._file]) byFile[i._file] = [];
  byFile[i._file].push(i);
});

// Deduplicate within each file by normalized title
const dedupByFile = (items) => {
  const byTitle = {};
  items.forEach(i => {
    const key = i.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!byTitle[key]) byTitle[key] = [];
    byTitle[key].push(i);
  });
  return byTitle;
};

console.log('='.repeat(80));
console.log('DEDUPLICATED ISSUES BY FILE');
console.log('='.repeat(80));

let totalDistinct = 0;
const allDistinct = [];

Object.entries(byFile).forEach(([file, items]) => {
  const byTitle = dedupByFile(items);
  const count = Object.keys(byTitle).length;
  totalDistinct += count;
  console.log(`\n[${file}] => ${items.length} raw -> ${count} distinct`);

  Object.entries(byTitle).forEach(([title, group]) => {
    const severities = [...new Set(group.map(i => i.severity))];
    const topSev = severities.includes('critical') ? 'CRITICAL'
      : severities.includes('high') || severities.includes('serious') ? 'HIGH'
      : severities.includes('medium') || severities.includes('major') ? 'MEDIUM'
      : 'LOW';
    const agentCount = group.length;
    const sampleFix = group[0].fix;
    console.log(`  [${topSev}] (x${agentCount}) ${title.slice(0, 80)}`);
    console.log(`    Fix: ${sampleFix.slice(0, 100)}...`);
    allDistinct.push({ file, title, severity: topSev, agentCount, fix: sampleFix });
  });
});

console.log('\n' + '='.repeat(80));
console.log(`TOTAL: ${all.length} raw -> ${totalDistinct} distinct -> ${allDistinct.length} after dedup`);
console.log('='.repeat(80));

// Breakdown by severity
const sevBreakdown = {};
allDistinct.forEach(i => {
  sevBreakdown[i.severity] = (sevBreakdown[i.severity] || 0) + 1;
});
console.log('\nBy severity:', sevBreakdown);

// Should-fix count
const shouldFix = allDistinct.filter(i => ['CRITICAL', 'HIGH'].includes(i.severity));
console.log(`Must/HIGH fix: ${shouldFix.length}`);
shouldFix.forEach(i => console.log(`  [${i.severity}] ${i.title.slice(0, 80)}`));
