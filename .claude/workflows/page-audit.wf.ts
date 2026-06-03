/**
 * Page Audit Workflow
 */
export const meta = {
  name: 'page-audit',
  description: 'Page audit and fix',
  phases: ['Discover', 'Analyze', 'Fix', 'Report'],
};
phase('Discover');
const pageName = args || 'Customer Dashboard';
log('========================================');
log('AUDITING: ' + pageName);
log('========================================');
const discovery = await agent('Find files for: ' + pageName, {schema: {type: 'object', properties: {files: {type: 'array', items: {type: 'string'}}}});
const files = discovery.files || [];
log('Found ' + files.length + ' files');
phase('Analyze');
const analysis = await agent('List issues in: ' + files.slice(0, 30).join(', '), {schema: {type: 'object', properties: {issues: {type: 'array', items: {type: 'object', properties: {severity: {type: 'string'}, title: {type: 'string'}, file: {type: 'string'}}}}});
const issues = analysis.issues || [];
log('ISSUES: ' + issues.length);
for (var i = 0; i < Math.min(issues.length, 20); i++) {
  var issue = issues[i];
  log('[' + issue.severity + '] ' + issue.title);
}
phase('Fix');
if (issues.length > 0) {
  var critical = issues.filter(function(i) { return i.severity === 'critical'; });
  if (critical.length > 0) {
    await parallel(critical.slice(0, 3).map(function(issue, i) {
      return function() {
        return agent('FIX: ' + issue.title + ' in ' + issue.file, {label: 'fix-' + i});
      };
    }));
  }
}
phase('Report');
log('========================================');
log('DONE - ' + issues.length + ' issues found');
log('========================================');
return {page: pageName, issues: issues.length};
