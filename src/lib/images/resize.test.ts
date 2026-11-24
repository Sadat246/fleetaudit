import { describe, expect, it } from 'vitest';
import { fitWithin } from './resize';

describe('fitWithin', () => {
  it('shrinks a large landscape photo so the long side is the max', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
  });
  it('shrinks a portrait photo by its height', () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });
  it('never enlarges a small photo', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
