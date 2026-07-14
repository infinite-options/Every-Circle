#!/usr/bin/env node

/**
 * Script to increment the build number in version.json
 * This should be run before each build/compile
 */

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, 'version.json');

function formatLastChangeDate(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

try {
  // Read current version
  const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  
  // Increment build number
  versionData.build = (versionData.build || 0) + 1;

  // Keep last_change in sync with the day this build ran
  versionData.last_change = formatLastChangeDate();
  
  // Write back to file
  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  
  console.log(`Build number incremented to: ${versionData.major}.${versionData.build} (last_change: ${versionData.last_change})`);
} catch (error) {
  console.error('Error incrementing build number:', error);
  process.exit(1);
}

