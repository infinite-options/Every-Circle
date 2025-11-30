/**
 * Script to find potential "Unexpected text node" issues
 * Scans for patterns that could render text directly in Views
 */

const fs = require('fs');
const path = require('path');

function findTextNodeIssues(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    
    // Pattern 1: Conditional rendering that might return a string
    // {value && something} where something might be a string
    if (line.match(/\{[^<]*&&\s*[^<{]/) && !line.includes('<Text') && !line.includes('return null')) {
      issues.push({
        line: lineNum,
        type: 'conditional_string',
        code: line.trim(),
        issue: 'Conditional might render string directly'
      });
    }
    
    // Pattern 2: Ternary that might return a string
    if (line.match(/\{[^<]*\?[^<]*:[^<]*\}/) && !line.includes('<Text') && !line.includes('return null')) {
      issues.push({
        line: lineNum,
        type: 'ternary_string',
        code: line.trim(),
        issue: 'Ternary might return string directly'
      });
    }
    
    // Pattern 3: String concatenation in JSX
    if (line.match(/\{[^<]*`.*\$\{.*\}.*`/) || line.match(/\{[^<]*\+.*\+/)) {
      if (!line.includes('<Text')) {
        issues.push({
          line: lineNum,
          type: 'string_concat',
          code: line.trim(),
          issue: 'String concatenation might create period'
        });
      }
    }
    
    // Pattern 4: Direct property access that might be period
    if (line.match(/\{[^<]*\.[a-zA-Z_][a-zA-Z0-9_]*\}/) && !line.includes('<Text') && !line.includes('sanitizeText')) {
      issues.push({
        line: lineNum,
        type: 'direct_property',
        code: line.trim(),
        issue: 'Direct property access without sanitization'
      });
    }
  });

  return issues;
}

// Scan all screen files
const screensDir = path.join(__dirname, '../screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.js'));

console.log('Scanning for potential text node issues...\n');

files.forEach(file => {
  const filePath = path.join(screensDir, file);
  const issues = findTextNodeIssues(filePath);
  
  if (issues.length > 0) {
    console.log(`\n${file}:`);
    issues.forEach(issue => {
      console.log(`  Line ${issue.line} (${issue.type}): ${issue.issue}`);
      console.log(`    ${issue.code.substring(0, 80)}...`);
    });
  }
});

