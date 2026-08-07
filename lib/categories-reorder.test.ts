import { describe, expect, it } from 'vitest';
import { reorderIds } from './categories-reorder';

describe('reorderIds', () => {
  it('moves the active item to the position of the over item, shifting the rest', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item earlier in the list', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same order when active and over are the same', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('returns the original array unchanged when either id is not found', () => {
    expect(reorderIds(['a', 'b', 'c'], 'x', 'b')).toEqual(['a', 'b', 'c']);
    expect(reorderIds(['a', 'b', 'c'], 'a', 'x')).toEqual(['a', 'b', 'c']);
  });
});
