#!/usr/bin/env node
const fs = require('fs');
const pbxprojPath = './ios/App/App.xcodeproj/project.pbxproj';

if (!fs.existsSync(pbxprojPath)) {
  console.log('Skipping SPM signing fix: no pbxproj found');
  process.exit(0);
}

let content = fs.readFileSync(pbxprojPath, 'utf8');
let result = '';
let i = 0;

while (i < content.length) {
  const bsStart = content.indexOf('buildSettings = {', i);
  if (bsStart === -1) { result += content.slice(i); break; }

  result += content.slice(i, bsStart);

  // Find matching closing brace
  let depth = 0;
  let j = bsStart + 'buildSettings = {'.length - 1;
  let bsEnd = -1;
  for (; j < content.length; j++) {
    if (content[j] === '{') depth++;
    else if (content[j] === '}') { depth--; if (depth === 0) { bsEnd = j; break; } }
  }

  if (bsEnd === -1) { result += content.slice(bsStart); break; }

  const block = content.slice(bsStart, bsEnd + 1);

  // Only patch package targets — they won't have INFOPLIST_FILE (that's your app target)
  if (!block.includes('INFOPLIST_FILE') && !block.includes('CODE_SIGNING_ALLOWED')) {
    result += block.replace('buildSettings = {', 'buildSettings = {\n\t\t\t\tCODE_SIGNING_ALLOWED = NO;');
  } else {
    result += block;
  }

  i = bsEnd + 1;
}

fs.writeFileSync(pbxprojPath, result);
console.log('✅ SPM signing fix applied — Firebase package targets excluded from signing');