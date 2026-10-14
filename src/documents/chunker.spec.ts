import { chunkText, extractTitle, stripExtension } from './chunker.js';

describe('chunkText (markdown)', () => {
  it('splits at headings and records the heading trail', () => {
    const md = [
      '# Guide', 'Intro text.', '',
      '## Setup', 'Install it.', '',
      '### Docker', 'Run compose.', '',
      '## Usage', 'Call the API.',
    ].join('\n');
    const chunks = chunkText(md, 'markdown');
    expect(chunks.map((c) => [c.headingPath, c.content])).toEqual([
      ['Guide', '# Guide\n\nIntro text.'],
      ['Guide > Setup', '## Setup\n\nInstall it.'],
      ['Guide > Setup > Docker', '### Docker\n\nRun compose.'],
      ['Guide > Usage', '## Usage\n\nCall the API.'],
    ]);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2, 3]);
  });

  it('keeps text before the first heading with an empty heading path', () => {
    expect(chunkText('Preamble.\n\n# Title\nBody.', 'markdown').map((c) => c.headingPath)).toEqual(['', 'Title']);
  });

  it('skips headings that have no body', () => {
    expect(chunkText('# Only\n\n## Empty\n\n## Full\nText.', 'markdown').map((c) => c.headingPath)).toEqual([
      'Only > Full',
    ]);
  });

  it('treats level-4 headings as body text', () => {
    const chunks = chunkText('# A\n#### small\ntext', 'markdown');
    expect(chunks).toEqual([{ index: 0, headingPath: 'A', content: '# A\n\n#### small\ntext' }]);
  });

  it('keeps a fenced code block whole and ignores # inside it', () => {
    const md = ['# Code', '```bash', '# not a heading', '', 'echo hi', '```'].join('\n');
    expect(chunkText(md, 'markdown')).toEqual([
      { index: 0, headingPath: 'Code', content: '# Code\n\n```bash\n# not a heading\n\necho hi\n```' },
    ]);
  });

  it('packs paragraphs up to maxChars and never exceeds it', () => {
    const paragraph = 'word '.repeat(20).trim(); // 99 characters
    const md = Array.from({ length: 10 }, () => paragraph).join('\n\n');
    const chunks = chunkText(md, 'markdown', 250);
    expect(chunks).toHaveLength(5); // 99 + 2 + 99 = 200 fits, a third paragraph does not
    expect(chunks.every((c) => c.content.length <= 250)).toBe(true);
  });

  it('splits a block larger than maxChars at line breaks', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i} `.padEnd(40, 'x'));
    const code = ['```', ...lines, '```'].join('\n');
    const chunks = chunkText(code, 'markdown', 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 200)).toBe(true);
    expect(chunks.map((c) => c.content).join('\n')).toBe(code);
  });
});

describe('chunkText (text)', () => {
  it('packs paragraphs with an empty heading path and no heading logic', () => {
    expect(chunkText('# not a heading\n\nsecond para', 'text')).toEqual([
      { index: 0, headingPath: '', content: '# not a heading\n\nsecond para' },
    ]);
  });

  it('returns nothing for blank input', () => {
    expect(chunkText(' \n\n\t\n', 'text')).toEqual([]);
    expect(chunkText('', 'markdown')).toEqual([]);
  });

  it('normalises Windows line endings', () => {
    expect(chunkText('# T\r\nbody\r\n', 'markdown')[0].content).toBe('# T\n\nbody');
  });
});

describe('extractTitle', () => {
  it('uses the first level-1 heading outside code fences', () => {
    expect(extractTitle('```\n# fake\n```\n## Sub\n# Real Title\n', 'notes.md')).toBe('Real Title');
  });

  it('falls back to the filename without its extension', () => {
    expect(extractTitle('no heading here', 'my-notes.md')).toBe('my-notes');
    expect(stripExtension('archive.tar.md')).toBe('archive.tar');
  });
});
