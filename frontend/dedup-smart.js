import fs from 'fs';

const journalPath = 'C:/Users/user/.claude/projects/C--Users-user-OneDrive-Desktop-rez-v5-Homeservice/643a03f4-3e14-4621-ae6b-f2de3f7534b6/subagents/workflows/wf_e0052763-7fa/journal.jsonl';
const lines = fs.readFileSync(journalPath, 'utf8').split('\n').filter(Boolean);
const results = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(r => r && r.type === 'result');
const all = results.flatMap(r => (r.result?.issues || []).map(i => ({ ...i, agentId: r.agentId })));

// Normalize file
const nf = (f) => f ? f.replace(/\\/g, '/').split('/').slice(-2).join('/') : 'unknown';
all.forEach(i => { i._file = nf(i.file); });

// Smart root-cause deduplication: group by [file + root-cause-keyword]
// Keywords that indicate the same underlying problem
const ROOT_CAUSE_GROUPS = {
  // Token not defined
  'rounded-nilin not defined': /rounded-nilin|rounded nilin/,
  'shadow-nilin-warm-lg not defined': /shadow-nilin-warm-lg|shadow nilin warm lg/,
  // Scroll
  'modal width too narrow': /modal (max |size too|too small|too narrow|xl 576|xl=576|size="xl")/,
  'nested scroll broken': /nested scroll|overflow-y-auto overflow-x|inner overflow-x-auto|scroll container/,
  'action row scrolls away': /action row.*scroll|scroll.*action row|not sticky|scrolls out of view/,
  // Header card
  'header card height varies': /header card height|variable.*header|header row.*height|best badges.*wrap|best badge.*wrap/,
  'header row alignment': /header row.*alignment|alignment.*header|vertical alignment.*header|empty top-left/,
  'image missing fallback': /image fallback|missing fallback|no.*image.*fallback|empty.*image/,
  // Accessibility
  'image not keyboard accessible': /image.*keyboard|image.*focusable|image.*not.*keyboard|image.*accessible/,
  'title not keyboard accessible': /title.*keyboard|title.*focusable|title.*not.*keyboard|title.*accessible/,
  'no focus visible ring': /focus.*ring|focus.*indicator|focus.*visible|no visible focus/,
  'contrast badge': /contrast.*badge|badge.*contrast|white on.*coral.*badge|best.*label.*contrast/,
  'contrast warmgray': /contrast.*warmgray|warmgray.*contrast|metric.*label.*contrast/,
  'contrast bar buttons': /contrast.*bar|bar.*contrast|white.*60.*charcoal|charcoal.*contrast/,
  'aria hidden missing': /aria.?hidden|decorative icon/,
  'screen reader table': /semantic table|aria.*table|role.*table|screen reader.*table|not.*accessible.*table/,
  // UX
  'bar visible behind modal': /bar.*visible.*modal|bar.*behind|modal.*bar.*visible|hide.*bar.*modal/,
  'remove x too small': /touch target.*x|x.*touch|remove.*x.*small|x.*too.*small/,
  'modal stays open with 1 item': /modal.*open.*1|open.*1.*service|drops to 1|empty state.*modal/,
  'dead imports': /dead import|unused import|not used|unused.*import|never used/,
  // Currency
  'currency inconsistency': /currency.*inconsist|price.*convert|source currency.*user|inconsist.*currency/,
  // Other
  'bar rounded-2xl shadow-2xl': /rounded-2xl.*bar|bar.*rounded-2xl|shadow-2xl.*bar|bar.*shadow-2xl/,
  'border token missing': /border.*e8e4e0|hard.*coded.*border|border.*token/,
  'modal body 60vh cap': /60vh.*cap|body.*60vh|max-h.*60vh.*modal|modal.*60vh/,
  'checkbox invisible unchecked': /checkbox.*invisible|invisible.*unchecked|compare checkbox.*invisible/,
  'best badge overlap title': /badge.*wrap|title.*badge.*overlap|best badge.*push.*title/,
  'scrollbar under content': /negative margin.*scroll|scrollbar.*gutter|under.*scrollbar|mx-6.*scroll/,
  'aria live count': /aria.?live.*count|count.*announce/,
  'provider row alignment': /provider.*row.*align|metric.*label.*align/,
  'action buttons mobile cramped': /mobile.*action|action.*cramped|action.*mobile/,
  'modal description generic': /modal.*description.*generic|generic.*description/,
  'best badge hierarchy': /best badge.*hierarchy|top pick|badge.*overflow/,
  'font serif missing': /font-serif|serif.*title|title.*serif/,
  'image onClick overlap': /onclick.*overlap|stop propagation.*x|x.*stop prop/,
  'metric label alignment': /metric.*label.*align|label.*cell.*align/,
  'scrollbar on bar': /bar.*scrollbar|scrollbar.*bar/,
};

function findGroup(title) {
  const t = title.toLowerCase();
  for (const [group, regex] of Object.entries(ROOT_CAUSE_GROUPS)) {
    if (regex.test(t)) return group;
  }
  return t.slice(0, 60);
}

const groups = {};
all.forEach(i => {
  const key = i._file + '::' + findGroup(i.title);
  if (!groups[key]) groups[key] = [];
  groups[key].push(i);
});

console.log('='.repeat(80));
console.log('ROOT-CAUSE DEDUPLICATION');
console.log('='.repeat(80));

let mustFix = [];
let shouldFix = [];
let niceFix = [];

Object.entries(groups).forEach(([key, items]) => {
  const [_file, rootCause] = key.split('::');
  const severities = [...new Set(items.map(i => i.severity))];
  const topSev = severities.includes('critical') ? 'CRITICAL'
    : severities.includes('high') || severities.includes('serious') ? 'HIGH'
    : severities.includes('medium') || severities.includes('major') ? 'MEDIUM'
    : 'LOW';
  const agentCount = items.length;
  const file = items[0]._file;

  const entry = { rootCause, file, severity: topSev, agentCount, rawCount: items.length, fix: items[0].fix };

  if (topSev === 'CRITICAL' || topSev === 'HIGH') mustFix.push(entry);
  else if (topSev === 'MEDIUM') shouldFix.push(entry);
  else niceFix.push(entry);

  const marker = topSev === 'CRITICAL' ? '🚨' : topSev === 'HIGH' ? '🔴' : topSev === 'MEDIUM' ? '🟡' : '🟢';
  console.log(`\n${marker} [${topSev}] (x${agentCount}) ${file}`);
  console.log(`   Root cause: ${rootCause}`);
  console.log(`   Fix: ${items[0].fix.slice(0, 150)}`);
});

console.log('\n' + '='.repeat(80));
console.log(`TOTAL distinct root causes: ${Object.keys(groups).length}`);
console.log(`Must-fix (CRITICAL/HIGH): ${mustFix.length}`);
console.log(`Should-fix (MEDIUM): ${shouldFix.length}`);
console.log(`Nice-fix (LOW): ${niceFix.length}`);
console.log('='.repeat(80));

// Output for next step
const output = {
  total: Object.keys(groups).length,
  mustFix,
  shouldFix,
  niceFix,
};
fs.writeFileSync('C:/Users/user/OneDrive/Desktop/rez-v5/Homeservice/frontend/dedup-result.json', JSON.stringify(output, null, 2));
console.log('\nWritten to dedup-result.json');