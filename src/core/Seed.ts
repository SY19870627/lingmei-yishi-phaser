export type RandomGenerator = () => number;

function hashString(source: string): number {
  let h = 1779033703 ^ source.length;
  for (let i = 0; i < source.length; i += 1) {
    h = Math.imul(h ^ source.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * 建立可重現的亂數來源；使用 Mulberry32，輸入相同字串時輸出序列一致。
 */
export function seedFrom(seedSource: string): RandomGenerator {
  let state = hashString(seedSource || '');

  return function random(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
