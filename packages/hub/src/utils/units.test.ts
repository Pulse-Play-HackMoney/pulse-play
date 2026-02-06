import { toMicroUnits, fromMicroUnits, MICRO, ASSET } from './units';

describe('units', () => {
  describe('toMicroUnits', () => {
    test('converts integer amounts', () => {
      expect(toMicroUnits(10)).toBe('10000000');
    });

    test('converts fractional amounts', () => {
      expect(toMicroUnits(2.5)).toBe('2500000');
    });

    test('converts zero', () => {
      expect(toMicroUnits(0)).toBe('0');
    });

    test('rounds to nearest integer microunit', () => {
      // 1.123456789 * 1_000_000 = 1_123_456.789 → rounds to 1_123_457
      expect(toMicroUnits(1.1234567)).toBe('1123457');
    });
  });

  describe('fromMicroUnits', () => {
    test('converts microunit string to number', () => {
      expect(fromMicroUnits('10000000')).toBe(10);
    });

    test('converts fractional result', () => {
      expect(fromMicroUnits('2500000')).toBe(2.5);
    });

    test('converts zero', () => {
      expect(fromMicroUnits('0')).toBe(0);
    });
  });

  test('round-trip preserves integer amounts', () => {
    const original = 42;
    expect(fromMicroUnits(toMicroUnits(original))).toBe(original);
  });

  test('MICRO constant is 1_000_000', () => {
    expect(MICRO).toBe(1_000_000);
  });

  test('ASSET is ytest.usd', () => {
    expect(ASSET).toBe('ytest.usd');
  });
});
