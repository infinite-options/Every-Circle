#!/usr/bin/env node

/**
 * Script to increment the build number in version.json
 * This should be run before each build/compile
 */

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, 'version.json');

try {
  // Read current version
  const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  
  // Increment build number
  versionData.build = (versionData.build || 0) + 1;
  
  // Write back to file
  fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  
  console.log(`Build number incremented to: ${versionData.major}.${versionData.build}`);
} catch (error) {
  console.error('Error incrementing build number:', error);
  process.exit(1);
}

