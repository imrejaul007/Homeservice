#!/usr/bin/env node

/**
 * Generate Changelog Script
 *
 * Reads git commits since the last tag and generates a markdown changelog.
 * Categorizes commits by prefix (feat:, fix:, docs:, etc.)
 *
 * Usage: node scripts/generate-changelog.js [version]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');

// Commit type configurations
const COMMIT_TYPES = {
  feat: { title: 'Features', emoji: '✨', section: 1 },
  fix: { title: 'Bug Fixes', emoji: '🐛', section: 2 },
  perf: { title: 'Performance Improvements', emoji: '⚡', section: 3 },
  refactor: { title: 'Code Refactoring', emoji: '♻️', section: 4 },
  docs: { title: 'Documentation', emoji: '📚', section: 5 },
  style: { title: 'Styling', emoji: '💄', section: 6 },
  test: { title: 'Tests', emoji: '🧪', section: 7 },
  build: { title: 'Build System', emoji: '📦', section: 8 },
  ci: { title: 'CI/CD', emoji: '👷', section: 9 },
  chore: { title: 'Chores', emoji: '🔧', section: 10 },
  revert: { title: 'Reverts', emoji: '⏪', section: 11 },
};

// Get the latest tag
function getLatestTag() {
  try {
    const tag = execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf8' }).trim();
    return tag;
  } catch {
    return null;
  }
}

// Get commits since a tag (or all commits)
function getCommits(sinceTag) {
  const range = sinceTag ? `${sinceTag}..HEAD` : 'HEAD';

  try {
    const output = execSync(`git log ${range} --pretty=format:"%H|%s|%an|%ae|%ad|%body" --date=short`, {
      encoding: 'utf8',
    });

    return output.split('\n').filter(Boolean).map(line => {
      const [hash, subject, author, email, date, body] = line.split('|');
      return { hash, subject, author, email, date, body: body || '' };
    });
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return [];
  }
}

// Parse commit into structured data
function parseCommit(commit) {
  // Match conventional commit format: type(scope): message
  const match = commit.subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);

  if (match) {
    const [, type, scope, message] = match;
    return {
      type: type.toLowerCase(),
      scope: scope || null,
      message: message.trim(),
      breaking: message.includes('!') || commit.body.includes('BREAKING CHANGE'),
      hash: commit.hash.substring(0, 7),
      author: commit.author,
      date: commit.date,
      fullMessage: commit.subject,
    };
  }

  // Non-conventional commit
  return {
    type: 'other',
    scope: null,
    message: commit.subject,
    breaking: false,
    hash: commit.hash.substring(0, 7),
    author: commit.author,
    date: commit.date,
    fullMessage: commit.subject,
  };
}

// Group commits by type
function groupCommits(commits) {
  const groups = {};

  for (const commit of commits) {
    const parsed = parseCommit(commit);
    const type = parsed.type;

    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(parsed);
  }

  return groups;
}

// Generate markdown for a commit group
function generateGroupMarkdown(type, commits) {
  const config = COMMIT_TYPES[type];
  if (!config) return null;

  const lines = [];
  lines.push(`### ${config.emoji} ${config.title}`);
  lines.push('');

  for (const commit of commits) {
    const scope = commit.scope ? `**${commit.scope}:** ` : '';
    const breaking = commit.breaking ? ' [BREAKING]' : '';
    const prLink = commit.body.match(/\(#(\d+)\)/)?.[1];

    let message = `- ${scope}${commit.message}${breaking}`;

    if (prLink) {
      message += ` ([#${prLink}](https://github.com/nilin/app/pull/${prLink}))`;
    }

    message += ` (${commit.hash})`;

    lines.push(message);
  }

  lines.push('');
  return lines.join('\n');
}

// Generate full changelog
function generateChangelog(version, commits) {
  const today = new Date().toISOString().split('T')[0];
  const grouped = groupCommits(commits);

  const lines = [];

  // Header
  lines.push(`# Changelog`);
  lines.push('');
  lines.push(`All notable changes to this project will be documented in this file.`);
  lines.push('');
  lines.push(`The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`);
  lines.push('');

  // Version header
  lines.push(`## [${version}] - ${today}`);
  lines.push('');

  // Breaking changes section (if any)
  const breakingCommits = Object.values(grouped).flat().filter(c => c.breaking);
  if (breakingCommits.length > 0) {
    lines.push(`### ⚠️ BREAKING CHANGES`);
    lines.push('');

    for (const commit of breakingCommits) {
      const scope = commit.scope ? `**${commit.scope}:** ` : '';
      lines.push(`- ${scope}${commit.message} (${commit.hash})`);
    }

    lines.push('');
  }

  // Generate sections in order
  const sortedTypes = Object.keys(grouped)
    .filter(type => type !== 'other' && COMMIT_TYPES[type])
    .sort((a, b) => (COMMIT_TYPES[a]?.section || 99) - (COMMIT_TYPES[b]?.section || 99));

  // Features first
  if (grouped.feat) {
    lines.push(generateGroupMarkdown('feat', grouped.feat));
  }

  // Bug fixes second
  if (grouped.fix) {
    lines.push(generateGroupMarkdown('fix', grouped.fix));
  }

  // Other types
  for (const type of sortedTypes) {
    if (type !== 'feat' && type !== 'fix') {
      lines.push(generateGroupMarkdown(type, grouped[type]));
    }
  }

  // Other commits (not conventional)
  if (grouped.other && grouped.other.length > 0) {
    lines.push(generateGroupMarkdown('other', grouped.other));
  }

  // Append to existing changelog or create new
  let existingContent = '';
  if (fs.existsSync(CHANGELOG_PATH)) {
    existingContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    // Find where to insert (after header, before first ##)
    const firstSection = existingContent.indexOf('## [');
    if (firstSection > 0) {
      existingContent = existingContent.substring(firstSection);
    }
  }

  const fullContent = lines.join('\n') + '\n\n' + existingContent;

  return fullContent;
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const version = args[0] || 'Unreleased';

  console.log(`🔄 Generating changelog for version ${version}...`);

  const latestTag = getLatestTag();
  console.log(`📌 Latest tag: ${latestTag || 'None (all commits)'}`);

  const commits = getCommits(latestTag);
  console.log(`📝 Found ${commits.length} commits`);

  if (commits.length === 0) {
    console.log('⚠️  No commits found to document');
    process.exit(0);
  }

  const changelog = generateChangelog(version, commits);

  fs.writeFileSync(CHANGELOG_PATH, changelog, 'utf8');

  console.log(`✅ Changelog generated at ${CHANGELOG_PATH}`);

  // Print summary
  const grouped = groupCommits(commits);
  console.log('\n📊 Commit Summary:');
  for (const [type, items] of Object.entries(grouped)) {
    const config = COMMIT_TYPES[type];
    const label = config ? `${config.emoji} ${config.title}` : type;
    console.log(`  ${label}: ${items.length}`);
  }
}

main();
