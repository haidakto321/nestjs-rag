import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AskDto } from './ask.dto.js';

// Same steps as the global ValidationPipe (transform: true): build the class, then validate it.
const check = async (body: object) => {
  const dto = plainToInstance(AskDto, body);
  return { dto, failed: (await validate(dto)).map((error) => error.property) };
};

describe('AskDto', () => {
  it('fills history and mode with defaults when they are left out', async () => {
    const { dto, failed } = await check({ question: 'How?' });
    expect(failed).toEqual([]);
    expect(dto.history).toEqual([]);
    expect(dto.mode).toBe('rag');
  });

  it('rejects null history and mode instead of passing null on to the service', async () => {
    const { failed } = await check({ question: 'How?', history: null, mode: null });
    expect(failed).toEqual(['history', 'mode']);
  });
});
