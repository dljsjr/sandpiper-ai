#!/usr/bin/env node

const fs = require('node:fs');

// Read the input file
const inputFile = '/Users/doug.stephen/git/sandpiper-ai/references/blocks.txt';
const outputFile = '/Users/doug.stephen/git/sandpiper-ai/references/blocks-inverted.txt';

// Read the file content
let content = fs.readFileSync(inputFile, 'utf8');

// Replace block characters with a temporary placeholder, then spaces with blocks, then placeholder with spaces
// This avoids conflicts during replacement

// First, replace all block characters with a temporary placeholder
content = content.replace(/[█▛▀▜▖▐▘▗▟▄▚▞▝▀▘▌]/g, '~TEMP_BLOCK~');

// Then replace spaces with block characters
content = content.replace(/ /g, '█');

// Finally, replace the temporary placeholder with spaces
content = content.replace(/~TEMP_BLOCK~/g, ' ');

// Write the inverted content to the output file
fs.writeFileSync(outputFile, content);

console.log('Inverted blocks file created at:', outputFile);
