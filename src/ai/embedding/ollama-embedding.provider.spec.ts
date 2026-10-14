import { ServiceUnavailableException } from '@nestjs/common';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider.js';

const options = {
  ollamaBaseUrl: 'http://ollama.test',
  embeddingModel: 'nomic-embed-text',
  embeddingDim: 3,
  chatModel: 'qwen3:8b',
  chatThink: true,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('OllamaEmbeddingProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to /api/embed in batches of 32 and keeps the input order', async () => {
    const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
      const { model, input } = JSON.parse(String(init.body)) as { model: string; input: string[] };
      expect(model).toBe('nomic-embed-text');
      return json({ embeddings: input.map((text) => [text.length, 0, 0]) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const texts = Array.from({ length: 70 }, (_, i) => 'x'.repeat(i + 1));
    const vectors = await new OllamaEmbeddingProvider(options).embed(texts);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://ollama.test/api/embed');
    expect(vectors.map((v) => v[0])).toEqual(texts.map((t) => t.length));
  });

  it('answers 503 when Ollama is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));
    await expect(new OllamaEmbeddingProvider(options).embed(['a'])).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('answers 503 on a non-2xx reply without echoing it to the client', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'model "x" not found' }, 404)));
    await expect(new OllamaEmbeddingProvider(options).embed(['a'])).rejects.toThrow('Embedding service unavailable');
  });

  it('answers 503 with a clear message when the model dimension is not EMBEDDING_DIM', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ embeddings: [[1, 2]] })));
    await expect(new OllamaEmbeddingProvider(options).embed(['a'])).rejects.toThrow(
      'Embedding model returned 2 dimensions but EMBEDDING_DIM is 3',
    );
  });

  it('does not call Ollama for an empty list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await new OllamaEmbeddingProvider(options).embed([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
