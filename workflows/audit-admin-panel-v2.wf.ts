/**
 * Simplified Admin Panel Management Page Audit
 */

export const meta = {
  name: 'audit-admin-panel-v2',
  description: 'Simplified audit of Admin Panel Management',
  phases: [
    { title: 'Discover', detail: 'File discovery' },
    { title: 'Analyze', detail: 'Single analysis pass' },
    { title: 'Fix', detail: 'Apply fixes' },
  ],
};

phase('Discover');

const pageName = args;

log(`AUDITING: ${pageName}`);

const discovery = await agent(`
Find all files related to Admin Panel Management (Service/Provider/Customer CRUD) in this codebase.

Search for:
1. frontend/src/pages/*admin*
2. frontend/src/components/**/*service*
3. frontend/src/components/**/*provider*
4. frontend/src/components/**/*customer*
5. backend/src/routes/*service*
6. backend/src/routes/*provider*
7. backend/src/routes/*customer*
8. backend/src/controllers/*service*
9. backend/src/controllers/*provider*
10. backend/src/controllers/*customer*

Return JSON with exact paths:
{
  "frontendFiles": ["path1", "path2"],
  "backendFiles": ["path1", "path2"],
  "totalFiles": 10
}
`, { label: 'discovery', schema: { type: 'object', properties: { frontendFiles: { type: 'array', items: { type: 'string' } }, backendFiles: { type: 'array', items: { type: 'string' } }, totalFiles: { type: 'number' } }, required: ['frontendFiles', 'backendFiles', 'totalFiles'] } });

log(`Found ${discovery.totalFiles} files`);

phase('Analyze');

const allFiles = [...(discovery.frontendFiles || []), ...(discovery.backendFiles || [])];

const analysis = await agent(`
Analyze these files for bugs and issues:
${allFiles.map(f => `- ${f}`).join('\n')}

CRITICAL CHECKS per CLAUDE.md:
1. Collection mismatch: Bundle vs Service for packages
2. Route order: specific routes before /:id
3. Field name mismatches: serviceId vs _id, serviceName vs name
4. Joi validation: frontend payload matches backend expectations

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "file": "path.ts",
    "line": 123,
    "title": "Issue title",
    "description": "Description",
    "fix": "How to fix"
  }],
  "summary": { "total": 10, "critical": 2 }
}
`, { label: 'analysis', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues', 'summary'] } });

const critical = (analysis.issues || []).filter(i => i.severity === 'critical');
const high = (analysis.issues || []).filter(i => i.severity === 'high');

log(`Found ${(analysis.issues || []).length} issues: ${critical.length} critical, ${high.length} high`);

phase('Fix');

if (critical.length > 0) {
  log(`Fixing ${critical.length} critical issues...`);
  for (const issue of critical) {
    await agent(`Fix this issue:
FILE: ${issue.file}
LINE: ${issue.line}
ISSUE: ${issue.title}
${issue.description}
FIX: ${issue.fix}
Return JSON: { "status": "fixed", "changed": "what was changed" }`,
    { label: `fix-${issue.file.split('/').pop()}`, schema: { type: 'object', properties: { status: { type: 'string' }, changed: { type: 'string' } } } });
    log(`  Fixed: ${issue.title}`);
  }
}

if (high.length > 0) {
  log(`Fixing ${high.length} high issues...`);
  for (const issue of high) {
    await agent(`Fix: ${issue.title}
FILE: ${issue.file}
FIX: ${issue.fix}
Return JSON: { "status": "fixed" }`,
    { label: `fix-${issue.file.split('/').pop()}`, schema: { type: 'object', properties: { status: { type: 'string' } } } });
    log(`  Fixed: ${issue.title}`);
  }
}

log(`\nAUDIT COMPLETE: ${pageName}`);
return { pageName, issuesFound: (analysis.issues || []).length, criticalFixed: critical.length, highFixed: high.length };