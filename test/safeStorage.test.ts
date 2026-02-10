import { describe, it, expect, beforeEach } from 'vitest';
import { safeParseLocal } from '../src/utils/safeStorage';

describe('safeParseLocal', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns null for missing key', () => {
        const res = safeParseLocal('no-such-key');
        expect(res).toBeNull();
    });

    it('parses simple JSON value', () => {
        localStorage.setItem('simple', JSON.stringify({ a: 1, b: 'x' }));
        const res = safeParseLocal<{ a: number; b: string }>('simple');
        expect(res).toEqual({ a: 1, b: 'x' });
    });

    it('strips __proto__ and prototype and constructor keys', () => {
        const malicious: any = { good: 1 };
        malicious.__proto__ = { injected: true };
        malicious.constructor = { evil: true };
        malicious.prototype = { nope: true };

        localStorage.setItem('mal', JSON.stringify(malicious));
        const res: any = safeParseLocal('mal');
        expect(res).toBeTruthy();
        expect(res.good).toBe(1);
        expect(res.__proto__).toBeUndefined();
        expect(res.constructor).toBeUndefined();
        expect(res.prototype).toBeUndefined();
        // Ensure Object.prototype is not polluted
        // @ts-ignore
        expect(({} as any).injected).toBeUndefined();
    });

    it('handles nested malicious keys deeply', () => {
        const nested = { a: { b: { c: 2, __proto__: { pwnd: true } } } } as any;
        localStorage.setItem('deep', JSON.stringify(nested));
        const res: any = safeParseLocal('deep');
        expect(res.a.b.c).toBe(2);
        expect(res.a.b.__proto__).toBeUndefined();
    });

    it('returns null on malformed JSON', () => {
        // invalid JSON
        // eslint-disable-next-line no-sparse-arrays
        localStorage.setItem('bad', '{ invalid: , }');
        const res = safeParseLocal('bad');
        expect(res).toBeNull();
    });

    it('sanitizes arrays and nested objects', () => {
        const obj = { arr: [1, { x: 2, __proto__: { a: 1 } }], s: 'ok' } as any;
        localStorage.setItem('arr', JSON.stringify(obj));
        const res: any = safeParseLocal('arr');
        expect(Array.isArray(res.arr)).toBe(true);
        expect(res.arr[1].x).toBe(2);
        expect(res.arr[1].__proto__).toBeUndefined();
    });
});
