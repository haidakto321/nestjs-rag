export type TextKind = 'markdown' | 'text';

export interface TextChunk {
  index: number;
  headingPath: string;
  content: string;
}

export const DEFAULT_MAX_CHARS = 1500;

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const TITLE = /^#\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

interface Section {
  headingPath: string;
  heading: string | null;
  lines: string[];
}

/**
 * Markdown: one section per heading (levels 1-3), heading trail as headingPath, paragraphs packed
 * up to maxChars, fenced code kept whole unless it alone is too big. Text: paragraphs only.
 */
export function chunkText(raw: string, kind: TextKind, maxChars = DEFAULT_MAX_CHARS): TextChunk[] {
  const text = raw.replace(/\r\n?/g, '\n');
  const sections: Section[] =
    kind === 'markdown' ? splitSections(text) : [{ headingPath: '', heading: null, lines: text.split('\n') }];
  const chunks: TextChunk[] = [];
  for (const section of sections) {
    const blocks = toBlocks(section.lines);
    if (blocks.length === 0) continue;
    if (section.heading) blocks.unshift(section.heading);
    for (const content of pack(blocks, maxChars)) {
      chunks.push({ index: chunks.length, headingPath: section.headingPath, content });
    }
  }
  return chunks;
}

export function extractTitle(text: string, filename: string): string {
  let inFence = false;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    const match = inFence ? null : TITLE.exec(line);
    if (match) return match[1];
  }
  return stripExtension(filename);
}

export function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || filename;
}

function splitSections(text: string): Section[] {
  const sections: Section[] = [];
  const trail: string[] = [];
  let current: Section = { headingPath: '', heading: null, lines: [] };
  let inFence = false;
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const match = inFence ? null : HEADING.exec(line);
    if (!match) {
      current.lines.push(line);
      continue;
    }
    sections.push(current);
    const level = match[1].length;
    trail.length = level - 1;
    trail[level - 1] = match[2];
    current = { headingPath: trail.filter(Boolean).join(' > '), heading: line.trim(), lines: [] };
  }
  sections.push(current);
  return sections;
}

// Blank lines separate blocks, except inside a fenced code block.
function toBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let buffer: string[] = [];
  let inFence = false;
  const flush = () => {
    const block = buffer.join('\n').trim();
    if (block) blocks.push(block);
    buffer = [];
  };
  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === '') {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

function pack(blocks: string[], maxChars: number): string[] {
  const out: string[] = [];
  let current = '';
  const pieces = blocks.flatMap((block) => (block.length > maxChars ? splitOversized(block, maxChars) : [block]));
  for (const piece of pieces) {
    if (!current) current = piece;
    else if (current.length + 2 + piece.length <= maxChars) current += `\n\n${piece}`;
    else {
      out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}

// Last resort for one block bigger than maxChars: split at line breaks, then inside very long lines.
function splitOversized(block: string, maxChars: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const line of block.split('\n')) {
    for (let start = 0; start < Math.max(line.length, 1); start += maxChars) {
      const part = line.slice(start, start + maxChars);
      if (!current) current = part;
      else if (current.length + 1 + part.length <= maxChars) current += `\n${part}`;
      else {
        out.push(current);
        current = part;
      }
    }
  }
  if (current) out.push(current);
  return out;
}
