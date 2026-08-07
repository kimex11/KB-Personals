import { describe, expect, it } from 'vitest';
import { generateMockCreditCardDues, generateMockIncomeSources } from './accounts-data';

describe('generateMockCreditCardDues', () => {
  const cards = generateMockCreditCardDues(new Date(2026, 7, 15));

  it('generates at least 2 credit cards', () => {
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every card a positive statement balance and minimum payment', () => {
    for (const card of cards) {
      expect(card.statementBalance).toBeGreaterThan(0);
      expect(card.minimumPayment).toBeGreaterThan(0);
    }
  });

  it('assigns each card a unique id', () => {
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('generateMockIncomeSources', () => {
  const sources = generateMockIncomeSources(new Date(2026, 7, 15));

  it('generates at least 1 income source', () => {
    expect(sources.length).toBeGreaterThanOrEqual(1);
  });

  it('gives every source a positive amount', () => {
    for (const source of sources) {
      expect(source.amount).toBeGreaterThan(0);
    }
  });

  it('assigns each source a unique id', () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
