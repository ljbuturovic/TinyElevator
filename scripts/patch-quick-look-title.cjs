/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');

// Quick Look derives its title from TinyElevator's internal storage filename.
// Keep a single blank space so iOS receives a non-nil, visually empty title.
const swiftFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@magrinj',
  'expo-quick-look',
  'ios',
  'PreviewDataSource.swift'
);
const before = 'self.previewItemTitle = title ?? url.deletingPathExtension().lastPathComponent';
const after = 'self.previewItemTitle = title ?? " "';
const source = fs.readFileSync(swiftFile, 'utf8');

if (source.includes(after)) {
  console.log('Quick Look title patch already applied.');
} else if (source.includes(before)) {
  fs.writeFileSync(swiftFile, source.replace(before, after));
  console.log('Quick Look title hidden.');
} else {
  throw new Error('Unexpected Quick Look source; review the title patch before building.');
}
