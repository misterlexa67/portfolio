import { describe, expect, it } from 'vitest';
import { planFor } from '../src/api/geometry';
import { buildScene } from '../src/components/iso/engine';

const cases: [number, number, number][] = [[32, 1, 1], [55, 2, 1], [75, 3, 1], [110, 3, 2], [160, 4, 2], [250, 5, 3]];

describe('мебель по площади', () => {
  it('одинаковые параметры — одинаковая расстановка', () => {
    const p = { area: 160, house: 'novostroyka' as const, rooms: 4, bathrooms: 2 };
    const a = buildScene(planFor(p), { level: 'standard', detail: 'high', type: 'capital' });
    const b = buildScene(planFor(p), { level: 'standard', detail: 'high', type: 'capital' });
    expect(a.sorted.map((x) => x.key)).toEqual(b.sorted.map((x) => x.key));
  });
  it('ни одна комната не пустая на 32–250 м²', () => {
    for (const [area, rooms, bathrooms] of cases) {
      const plan = planFor({ area, house: 'novostroyka', rooms, bathrooms });
      const scene = buildScene(plan, { level: 'standard', detail: 'high', type: 'capital' });
      const keys = [...scene.sorted, ...scene.flat].filter((x) => x.layer === 'furniture').map((x) => x.key);
      for (const r of plan.items.filter((i) => i.kind !== 'balcony')) {
        expect(keys.some((k) => k.startsWith(`${r.id}-`)), `${area} м²: «${r.name}» без мебели`).toBe(true);
      }
    }
  });
  it('комнат становится больше вместе с площадью, огромных пустых коробок нет', () => {
    const counts = cases.map(([area, rooms, bathrooms]) => planFor({ area, house: 'novostroyka', rooms, bathrooms }).items.length);
    expect(counts[5]).toBeGreaterThan(counts[2] + 4);
    const big = planFor({ area: 250, house: 'panel90', rooms: 2, bathrooms: 1 });
    expect(Math.max(...big.items.filter((i) => i.kind !== 'balcony').map((i) => i.area))).toBeLessThan(45);
  });
  it('площадь ±12 м² меняет расстановку', () => {
    const k = (area: number) => buildScene(planFor({ area, house: 'panel90', rooms: 3, bathrooms: 1 }), { level: 'standard', detail: 'high', type: 'capital' })
      .sorted.filter((x) => x.layer === 'furniture').map((x) => x.key).join();
    expect(k(62)).not.toBe(k(74));
  });
});
