#!/usr/bin/env node

/**
 * FIFO persistent handle test
 * 
 * Tests the pattern where Node.js holds a sentinel write handle on a FIFO
 * so that multiple external writers (like `tee`) can open/write/close
 * without the reader getting EOF.
 *
 * Usage:
 *   1. Run this script: ./fifo-test.mjs
 *   2. In another terminal (in the same directory or using the printed paths),
 *      run commands that write to the FIFOs:
 *
 *      # Basic test (no unbuffer):
 *      { ls /tmp /nonexistent | tee /tmp/shell-relay-test/stdout.fifo > /dev/tty; set -g __relay_exit $pipestatus[1]; } 2>&1 >/dev/null | tee /tmp/shell-relay-test/stderr.fifo
 *
 *      # Signal test:
 *      echo "prompt-ready:0" > /tmp/shell-relay-test/signal.fifo
 *      echo "prompt-ready:1" > /tmp/shell-relay-test/signal.fifo
 *
 *      # With unbuffer (if available):
 *      { unbuffer -p ls --color=always /tmp /nonexistent | tee /tmp/shell-relay-test/stdout.fifo > /dev/tty; set -g __relay_exit $pipestatus[1]; } 2>&1 >/dev/null | tee /tmp/shell-relay-test/stderr.fifo
 *
 *   3. Watch the script output — it should print each stream's data as it arrives,
 *      and continue listening after each command (no EOF).
 *
 *   4. Ctrl+C to stop. The script cleans up FIFOs on exit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

const FIFO_DIR = '/tmp/shell-relay-test';
const STDOUT_FIFO = path.join(FIFO_DIR, 'stdout.fifo');
const STDERR_FIFO = path.join(FIFO_DIR, 'stderr.fifo');
const SIGNAL_FIFO = path.join(FIFO_DIR, 'signal.fifo');

// --- Helpers ---

function createFifoDir() {
  if (!fs.existsSync(FIFO_DIR)) {
    fs.mkdirSync(FIFO_DIR, { mode: 0o700, recursive: true });
  }
}

function createFifo(fifoPath) {
  // Clean up stale FIFO if it exists
  try {
    fs.unlinkSync(fifoPath);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  execSync(`mkfifo "${fifoPath}"`);
  fs.chmodSync(fifoPath, 0o600);
}

function cleanup() {
  console.log('\n🧹 Cleaning up...');
  for (const f of [STDOUT_FIFO, STDERR_FIFO, SIGNAL_FIFO]) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
  try { fs.rmdirSync(FIFO_DIR); } catch (_) {}
  console.log('   Done.');
}

/**
 * Opens a FIFO with a persistent sentinel write handle.
 * Returns { readStream, close }.
 * 
 * Uses O_RDWR to open the FIFO, which:
 *   - Does NOT block on open (unlike O_RDONLY which waits for a writer)
 *   - Acts as its own sentinel: because the fd is open for writing,
 *     the FIFO never sees "all writers closed" and never sends EOF
 *   - Reads block normally when no data is available (unlike O_NONBLOCK
 *     which returns EAGAIN)
 */
function openPersistentFifo(fifoPath, label) {
  // O_RDWR on a FIFO: non-blocking open, blocking reads, self-sentinel
  const fd = fs.openSync(fifoPath, fs.constants.O_RDWR);

  const stream = fs.createReadStream(null, { fd, encoding: 'utf-8' });

  stream.on('error', (err) => {
    console.error(`❌ [${label}] Stream error:`, err.message);
  });

  stream.on('end', () => {
    // This should NOT happen while the fd is open
    console.warn(`⚠️  [${label}] Stream ended (unexpected — sentinel should prevent this)`);
  });

  stream.on('close', () => {
    console.log(`   [${label}] Stream closed.`);
  });

  return {
    stream,
    close: () => {
      try { fs.closeSync(fd); } catch (_) {}
    }
  };
}


// --- Main ---

console.log('🔧 Shell Relay FIFO Test');
console.log('========================\n');

// Create FIFOs
createFifoDir();
console.log(`📁 FIFO directory: ${FIFO_DIR}`);

for (const [label, fifoPath] of [['stdout', STDOUT_FIFO], ['stderr', STDERR_FIFO], ['signal', SIGNAL_FIFO]]) {
  createFifo(fifoPath);
  console.log(`   Created ${label}: ${fifoPath}`);
}
console.log('');

// Open persistent handles
const stdout = openPersistentFifo(STDOUT_FIFO, 'stdout');
const stderr = openPersistentFifo(STDERR_FIFO, 'stderr');
const signal = openPersistentFifo(SIGNAL_FIFO, 'signal');

// Track state for output delimiting
let commandCount = 0;
let stdoutBuffer = '';
let stderrBuffer = '';

// Handle stdout data
stdout.stream.on('data', (chunk) => {
  stdoutBuffer += chunk;
  // Print each line as it arrives
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop(); // keep incomplete line in buffer
  for (const line of lines) {
    if (line.length > 0) {
      console.log(`📤 [stdout] ${line}`);
    }
  }
});

// Handle stderr data
stderr.stream.on('data', (chunk) => {
  stderrBuffer += chunk;
  const lines = stderrBuffer.split('\n');
  stderrBuffer = lines.pop();
  for (const line of lines) {
    if (line.length > 0) {
      console.log(`📥 [stderr] ${line}`);
    }
  }
});

// Handle signal data
let signalBuffer = '';
signal.stream.on('data', (chunk) => {
  signalBuffer += chunk;
  const lines = signalBuffer.split('\n');
  signalBuffer = lines.pop();
  for (const line of lines) {
    if (line.length === 0) continue;
    
    // Parse signal
    const match = line.match(/^prompt-ready:(\d+)$/);
    if (match) {
      const exitCode = parseInt(match[1], 10);
      commandCount++;
      console.log(`\n🔔 [signal] Command #${commandCount} completed — exit code: ${exitCode}`);
      
      // Flush any remaining buffered output
      if (stdoutBuffer.length > 0) {
        console.log(`📤 [stdout] ${stdoutBuffer}`);
        stdoutBuffer = '';
      }
      if (stderrBuffer.length > 0) {
        console.log(`📥 [stderr] ${stderrBuffer}`);
        stderrBuffer = '';
      }
      
      console.log(`   (waiting for next command...)\n`);
    } else {
      console.log(`🔔 [signal] Unknown signal: ${line}`);
    }
  }
});

// Cleanup on exit
process.on('SIGINT', () => {
  stdout.close();
  stderr.close();
  signal.close();
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stdout.close();
  stderr.close();
  signal.close();
  cleanup();
  process.exit(0);
});

// Print instructions
console.log('✅ Listening on all three FIFOs.');
console.log('   Sentinel write handles held open (persistent mode).\n');
console.log('📋 Test commands to run in another terminal:\n');
console.log('   # Basic test (fish syntax):');
console.log(`   { ls /tmp /nonexistent | tee ${STDOUT_FIFO} > /dev/tty } 2>&1 >/dev/null | tee ${STDERR_FIFO} > /dev/tty`);
console.log(`   echo "prompt-ready:\\$status" > ${SIGNAL_FIFO}\n`);
console.log('   # With unbuffer (fish syntax):');
console.log(`   { unbuffer -p ls --color=always /tmp /nonexistent | tee ${STDOUT_FIFO} > /dev/tty } 2>&1 >/dev/null | tee ${STDERR_FIFO} > /dev/tty`);
console.log(`   echo "prompt-ready:\\$status" > ${SIGNAL_FIFO}\n`);
console.log('   # Multiple commands (should reuse FIFOs without EOF):');
console.log(`   echo "hello" > ${STDOUT_FIFO}`);
console.log(`   echo "world" > ${STDOUT_FIFO}`);
console.log(`   echo "prompt-ready:0" > ${SIGNAL_FIFO}\n`);
console.log('   Press Ctrl+C to stop.\n');
