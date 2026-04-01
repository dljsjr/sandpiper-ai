#!/usr/bin/env bun
import { createServerProxy } from './devtools/node_modules/mcporter/dist/index.js';

// Configuration to connect to the ascii-motion-mcp server
const serverConfig = {
  name: 'ascii-motion',
  command: {
    kind: 'stdio',
    command: 'bunx',
    args: ['ascii-motion-mcp', '--live', '--project-dir', '/Users/doug.stephen/git/sandpiper-ai'],
    cwd: '/Users/doug.stephen/git/sandpiper-ai/devtools/config',
  },
  lifecycle: {
    mode: 'keep-alive',
  },
};

interface AsciiMotionCell {
  x: number;
  y: number;
  char: string;
  bgColor: string;
}

interface AsciiMotionTool {
  new_project: (args: { template: string }) => Promise<void>;
  set_cells_batch: (args: { cells: readonly AsciiMotionCell[] }) => Promise<{ success: boolean }>;
  export_image: (args: { filePath: string }) => Promise<{ success: boolean; filePath?: string }>;
  dispose?: () => Promise<void>;
}

function row(y: number, fromX: number, toX: number): Array<{ x: number; y: number }> {
  return Array.from({ length: toX - fromX + 1 }, (_, index) => ({ x: fromX + index, y }));
}

function paint(bgColor: string, points: readonly { x: number; y: number }[]): AsciiMotionCell[] {
  return points.map((point) => ({ ...point, char: ' ', bgColor }));
}

async function main() {
  console.log('Connecting to ascii-motion server...');
  const tool = (await createServerProxy(serverConfig)) as AsciiMotionTool;

  console.log('Starting new 40x40 project...');
  await tool.new_project({ template: 'square-40x40' });

  console.log('Preparing pixel data...');
  const cells = [
    // Sun (gold)
    ...paint('gold', [
      ...row(3, 33, 35),
      ...row(4, 32, 36),
      ...row(5, 31, 37),
      ...row(6, 31, 37),
      ...row(7, 32, 36),
      ...row(8, 33, 35),
    ]),
    // Clouds (white)
    ...paint('white', [
      ...row(6, 27, 39),
      ...row(7, 27, 39),
      ...row(8, 29, 37),
      { x: 18, y: 4 },
      { x: 19, y: 4 },
      { x: 20, y: 4 },
      { x: 21, y: 4 },
      { x: 22, y: 4 },
      { x: 23, y: 4 },
      { x: 24, y: 4 },
      { x: 25, y: 4 },
      { x: 19, y: 5 },
      { x: 20, y: 5 },
      { x: 21, y: 5 },
      { x: 22, y: 5 },
      { x: 23, y: 5 },
      { x: 24, y: 5 },
      { x: 5, y: 11 },
      { x: 6, y: 11 },
      { x: 7, y: 11 },
      { x: 8, y: 11 },
      { x: 9, y: 11 },
      { x: 10, y: 11 },
      { x: 11, y: 11 },
      { x: 12, y: 11 },
      { x: 6, y: 12 },
      { x: 7, y: 12 },
      { x: 8, y: 12 },
      { x: 9, y: 12 },
      { x: 10, y: 12 },
      { x: 11, y: 12 },
      { x: 8, y: 16 },
      { x: 9, y: 16 },
      { x: 10, y: 16 },
      { x: 11, y: 16 },
      { x: 12, y: 16 },
      { x: 13, y: 16 },
      { x: 14, y: 16 },
      { x: 15, y: 16 },
      { x: 9, y: 17 },
      { x: 10, y: 17 },
      { x: 11, y: 17 },
      { x: 12, y: 17 },
      { x: 13, y: 17 },
      { x: 14, y: 17 },
    ]),
    // Water (darkblue)
    ...Array.from({ length: 36 * 8 }, (_, i) => ({
      x: 2 + (i % 36),
      y: 28 + Math.floor(i / 36),
      char: ' ',
      bgColor: 'darkblue',
    })),
    // Ripples (lightblue)
    ...[
      { x: 10, y: 29 },
      { x: 11, y: 29 },
      { x: 29, y: 29 },
      { x: 30, y: 29 },
      { x: 8, y: 30 },
      { x: 9, y: 30 },
      { x: 31, y: 30 },
      { x: 32, y: 30 },
      { x: 15, y: 31 },
      { x: 16, y: 31 },
      { x: 24, y: 31 },
      { x: 25, y: 31 },
      { x: 18, y: 32 },
      { x: 22, y: 32 },
      { x: 19, y: 33 },
      { x: 20, y: 33 },
      { x: 21, y: 33 },
      { x: 12, y: 34 },
      { x: 13, y: 34 },
      { x: 27, y: 34 },
      { x: 28, y: 34 },
      { x: 15, y: 35 },
      { x: 16, y: 35 },
      { x: 24, y: 35 },
      { x: 25, y: 35 },
    ].map((p) => ({ ...p, char: ' ', bgColor: 'lightblue' })),
    // Bird (white)
    ...[
      { x: 9, y: 25 },
      { x: 10, y: 25 },
      { x: 14, y: 23 },
      { x: 12, y: 24 },
      { x: 13, y: 24 },
      { x: 14, y: 24 },
      { x: 15, y: 24 },
      { x: 11, y: 25 },
      { x: 12, y: 25 },
      { x: 13, y: 25 },
      { x: 14, y: 25 },
      { x: 15, y: 25 },
      { x: 12, y: 26 },
      { x: 13, y: 26 },
      { x: 14, y: 26 },
      { x: 15, y: 26 },
      { x: 16, y: 25 },
      { x: 17, y: 25 },
      { x: 18, y: 25 },
      { x: 16, y: 26 },
      { x: 17, y: 26 },
      { x: 18, y: 26 },
      { x: 19, y: 26 },
      { x: 20, y: 26 },
      { x: 21, y: 26 },
      { x: 15, y: 27 },
      { x: 16, y: 27 },
      { x: 17, y: 27 },
      { x: 18, y: 27 },
      { x: 19, y: 27 },
      { x: 20, y: 27 },
      { x: 21, y: 27 },
      { x: 22, y: 27 },
      { x: 16, y: 28 },
      { x: 17, y: 28 },
      { x: 18, y: 28 },
      { x: 19, y: 28 },
      { x: 20, y: 28 },
      { x: 21, y: 28 },
      { x: 22, y: 28 },
      { x: 23, y: 28 },
      { x: 23, y: 27 },
      { x: 24, y: 27 },
      { x: 25, y: 27 },
      { x: 24, y: 28 },
      { x: 25, y: 28 },
      { x: 26, y: 28 },
      { x: 27, y: 28 },
      { x: 18, y: 29 },
      { x: 18, y: 30 },
      { x: 17, y: 31 },
      { x: 19, y: 31 },
      { x: 21, y: 29 },
      { x: 21, y: 30 },
      { x: 20, y: 31 },
      { x: 22, y: 31 },
    ].map((p) => ({ ...p, char: ' ', bgColor: 'white' })),
    // Bird Details (black)
    ...[
      { x: 13, y: 24 },
      { x: 18, y: 26 },
      { x: 20, y: 27 },
      { x: 22, y: 28 },
    ].map((p) => ({ ...p, char: ' ', bgColor: 'black' })),
  ];

  console.log(`Sending ${cells.length} pixels in a single batch...`);
  const batchResult = await tool.set_cells_batch({ cells });
  if (!batchResult.success) {
    console.error('Batch update failed:', batchResult);
    return;
  }

  console.log('Exporting to sandpiper-final.svg...');
  const exportResult = await tool.export_image({ filePath: 'sandpiper-final.svg' });

  if (exportResult.success) {
    console.log(`Image successfully exported to ${exportResult.filePath}`);
  } else {
    console.error('Image export failed:', exportResult);
  }

  // Manually close the connection
  if (tool.dispose) {
    await tool.dispose();
  }
}

main().catch(console.error);
