#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Config - adjust if your repo layout differs
const ROOT = path.resolve(__dirname, '..');
const CLIENT_SRC = path.join(ROOT, 'client', 'src');
const SHARED = path.join(ROOT, 'shared');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(full)) {
      fileList.push(full);
    }
  }
  return fileList;
}

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = content;

  // Replace imports like "@/path/to/module"
  updated = updated.replace(/(['\"])@\/(.*?)\1/g, (m, quote, p1) => {
    const target = path.join(CLIENT_SRC, p1);
    let rel = path.relative(path.dirname(filePath), target);
    if (!rel.startsWith('.')) rel = './' + rel;
    // Normalize for posix in imports
    rel = rel.split(path.sep).join('/');
    return quote + rel + quote;
  });

  // Replace imports like "@shared/path/to/module"
  updated = updated.replace(/(['\"])@shared\/(.*?)\1/g, (m, quote, p1) => {
    const target = path.join(SHARED, p1);
    let rel = path.relative(path.dirname(filePath), target);
    if (!rel.startsWith('.')) rel = './' + rel;
    rel = rel.split(path.sep).join('/');
    return quote + rel + quote;
  });

  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Updated', path.relative(ROOT, filePath));
  }
}

function main() {
  console.log('Scanning', CLIENT_SRC);
  const files = walk(CLIENT_SRC);
  for (const f of files) replaceInFile(f);
  console.log('Done. Please run your typecheck and verify imports.');
}

main();
