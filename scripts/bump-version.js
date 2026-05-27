#!/usr/bin/env node

/**
 * Bump Version Script
 *
 * Increments semantic version and updates all relevant files.
 * Creates git tag automatically.
 *
 * Usage:
 *   node scripts/bump-version.js patch  # 1.0.0 -> 1.0.1
 *   node scripts/bump-version.js minor  # 1.0.0 -> 1.1.0
 *   node scripts/bump-version.js major  # 1.0.0 -> 2.0.0
 *   node scripts/bump-version.js 1.2.3  # Set specific version
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *   --no-tag     Don't create git tag
 *   --no-commit  Don't create git commit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'frontend', 'package.json');
const BUILD_GRADLE_PATH = path.join(ROOT_DIR, 'frontend', 'android', 'app', 'build.gradle');

// Parse version
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

// Format version back to string
function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}${version.prerelease ? '-' + version.prerelease : ''}`;
}

// Increment version
function incrementVersion(currentVersion, type) {
  const version = parseVersion(currentVersion);

  switch (type) {
    case 'major':
      version.major++;
      version.minor = 0;
      version.patch = 0;
      break;
    case 'minor':
      version.minor++;
      version.patch = 0;
      break;
    case 'patch':
      version.patch++;
      break;
    default:
      throw new Error(`Invalid increment type: ${type}`);
  }

  return formatVersion(version);
}

// Get current version from package.json
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    return packageJson.version;
  } catch (error) {
    throw new Error(`Failed to read version from ${PACKAGE_JSON_PATH}: ${error.message}`);
  }
}

// Update package.json version
function updatePackageJson(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const oldVersion = packageJson.version;

  packageJson.version = newVersion;

  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

  return oldVersion;
}

// Update Android build.gradle versionName
function updateBuildGradle(newVersion) {
  if (!fs.existsSync(BUILD_GRADLE_PATH)) {
    console.log(`⚠️  build.gradle not found at ${BUILD_GRADLE_PATH}, skipping`);
    return null;
  }

  let content = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');

  // Match versionName "x.y.z" pattern
  const versionNamePattern = /versionName\s+["']([^"']+)["']/;
  const match = content.match(versionNamePattern);

  if (!match) {
    console.log(`⚠️  Could not find versionName in build.gradle, skipping`);
    return null;
  }

  const oldVersion = match[1];

  // Replace versionName
  content = content.replace(versionNamePattern, `versionName "${newVersion}"`);

  fs.writeFileSync(BUILD_GRADLE_PATH, content, 'utf8');

  return oldVersion;
}

// Create git commit
function createGitCommit(newVersion) {
  try {
    execSync('git add -A', { cwd: ROOT_DIR });
    execSync(`git commit -m "chore: bump version to ${newVersion}"`, { cwd: ROOT_DIR });
    console.log(`✅ Created git commit for version ${newVersion}`);
    return true;
  } catch (error) {
    console.log(`⚠️  Failed to create git commit: ${error.message}`);
    return false;
  }
}

// Create git tag
function createGitTag(version) {
  const tagName = `v${version}`;

  try {
    // Check if tag already exists
    try {
      execSync(`git rev-parse "${tagName}"`, { cwd: ROOT_DIR });
      console.log(`⚠️  Tag ${tagName} already exists`);
      return false;
    } catch {
      // Tag doesn't exist, which is what we want
    }

    execSync(`git tag -a "${tagName}" -m "Release ${tagName}"`, { cwd: ROOT_DIR });
    console.log(`✅ Created git tag: ${tagName}`);
    return true;
  } catch (error) {
    console.log(`⚠️  Failed to create git tag: ${error.message}`);
    return false;
  }
}

// Push changes
function pushChanges(remote = 'origin') {
  try {
    execSync(`git push ${remote} HEAD`, { cwd: ROOT_DIR });
    console.log(`✅ Pushed changes to ${remote}`);
    return true;
  } catch (error) {
    console.log(`⚠️  Failed to push changes: ${error.message}`);
    return false;
  }
}

// Push tags
function pushTags(remote = 'origin') {
  try {
    execSync(`git push ${remote} --tags`, { cwd: ROOT_DIR });
    console.log(`✅ Pushed tags to ${remote}`);
    return true;
  } catch (error) {
    console.log(`⚠️  Failed to push tags: ${error.message}`);
    return false;
  }
}

// Dry run - show what would be done
function dryRun(currentVersion, newVersion) {
  console.log('\n🔍 DRY RUN - No changes will be made\n');

  console.log(`📦 Current version: ${currentVersion}`);
  console.log(`📦 New version: ${newVersion}\n`);

  console.log('Files that would be updated:');
  console.log(`  - ${path.relative(ROOT_DIR, PACKAGE_JSON_PATH)}`);

  if (fs.existsSync(BUILD_GRADLE_PATH)) {
    console.log(`  - ${path.relative(ROOT_DIR, BUILD_GRADLE_PATH)}`);
  }

  console.log('\nGit operations that would be performed:');
  console.log('  - git add -A');
  console.log(`  - git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`  - git tag -a "v${newVersion}" -m "Release v${newVersion}"`);
  console.log(`  - git push origin HEAD`);
  console.log(`  - git push origin --tags`);
}

// Main function
function main() {
  const args = process.argv.slice(2);

  // Parse options
  const options = {
    dryRun: args.includes('--dry-run'),
    noTag: args.includes('--no-tag'),
    noCommit: args.includes('--no-commit'),
  };

  // Filter out options
  const versionArgs = args.filter(arg => !arg.startsWith('--'));

  if (versionArgs.length === 0) {
    console.error('Usage: node bump-version.js [patch|minor|major|x.y.z] [--dry-run] [--no-tag] [--no-commit]');
    console.error('');
    console.error('Examples:');
    console.error('  node bump-version.js patch     # 1.0.0 -> 1.0.1');
    console.error('  node bump-version.js minor     # 1.0.0 -> 1.1.0');
    console.error('  node bump-version.js major     # 1.0.0 -> 2.0.0');
    console.error('  node bump-version.js 1.2.3    # Set specific version');
    console.error('  node bump-version.js patch --dry-run  # Preview changes');
    process.exit(1);
  }

  const versionArg = versionArgs[0];
  let newVersion;

  // Get current version
  let currentVersion;
  try {
    currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  // Determine new version
  if (['patch', 'minor', 'major'].includes(versionArg)) {
    newVersion = incrementVersion(currentVersion, versionArg);
  } else if (/^\d+\.\d+\.\d+/.test(versionArg)) {
    newVersion = versionArg;
  } else {
    console.error(`❌ Invalid version or increment type: ${versionArg}`);
    process.exit(1);
  }

  console.log(`📦 New version: ${newVersion}`);

  // Dry run
  if (options.dryRun) {
    dryRun(currentVersion, newVersion);
    process.exit(0);
  }

  // Update files
  console.log('\n📝 Updating files...');

  let gradleOldVersion = null;

  try {
    const pkgOldVersion = updatePackageJson(newVersion);
    console.log(`✅ Updated package.json: ${pkgOldVersion} -> ${newVersion}`);

    gradleOldVersion = updateBuildGradle(newVersion);
    if (gradleOldVersion) {
      console.log(`✅ Updated build.gradle: ${gradleOldVersion} -> ${newVersion}`);
    }
  } catch (error) {
    console.error(`❌ Failed to update files: ${error.message}`);
    process.exit(1);
  }

  // Git operations
  if (!options.noCommit) {
    createGitCommit(newVersion);
  }

  if (!options.noTag) {
    const tagCreated = createGitTag(newVersion);

    if (tagCreated) {
      // Offer to push
      try {
        const shouldPush = args.includes('--push') || args.includes('-p');
        if (shouldPush) {
          pushChanges();
          pushTags();
        } else {
          console.log('\n💡 To push changes, run:');
          console.log(`   git push origin HEAD`);
          console.log(`   git push origin --tags`);
        }
      } catch (error) {
        console.error(`⚠️  Push failed: ${error.message}`);
      }
    }
  }

  console.log('\n✅ Version bump complete!');
  console.log(`\n📋 Summary:`);
  console.log(`   Version: ${currentVersion} -> ${newVersion}`);
  console.log(`   Commit: ${options.noCommit ? 'skipped' : 'created'}`);
  console.log(`   Tag: ${options.noTag ? 'skipped' : `v${newVersion}`}`);

  // Output new version for scripting
  console.log(`\n::set-output name=new_version::${newVersion}`);
}

main();
