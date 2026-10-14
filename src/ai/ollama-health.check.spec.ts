import { OllamaHealthCheck } from './ollama-health.check.js';

describe('OllamaHealthCheck', () => {
  it('warns instead of failing startup when Ollama is down', async () => {
    const check = new OllamaHealthCheck({
      dimension: 768,
      embed: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });
    await expect(check.onModuleInit()).resolves.toBeUndefined();
  });

  it('embeds one probe text when Ollama is up', async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map(() => Array.from({ length: 768 }, () => 0)));
    await new OllamaHealthCheck({ dimension: 768, embed }).onModuleInit();
    expect(embed).toHaveBeenCalledWith(['ping']);
  });
});
