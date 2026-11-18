import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Project } from '../api';
import { layersFor } from '../api/pricing';
import { IsoApartment } from './iso/IsoApartment';
import './beforeafter.css';

/* «До / после» — иллюстрации кодом, не фото. Тянется пальцем плавно, с сопротивлением у краёв.
   Раскрытие сделано только сдвигами (transform), без перерисовки маски. */

const BEFORE = { screed: false, partitions: true, electrics: false, warmFloor: false, walls: false, floor: false, light: false, furniture: false, conditioner: false };
const MIN = 4; const MAX = 96;

export function BeforeAfter({ project, lazy }: { project: Project; lazy?: boolean }) {
  const params = { area: project.area, house: project.house, rooms: project.rooms, bathrooms: project.bathrooms, type: project.type, level: project.level, options: project.options };
  const plan = useMemo(() => api.plans.forParams(params), [project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const after = useMemo(() => layersFor(params), [project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const stage = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const pos = useRef(55);
  const [aria, setAria] = useState(55);

  const paint = (p: number, anim = false) => {
    pos.current = p;
    const t = anim ? 'transform 420ms cubic-bezier(0.2, 0.9, 0.25, 1.15)' : 'none';
    [wrap.current, inner.current, line.current].forEach((el) => { if (el) el.style.transition = t; });
    if (wrap.current) wrap.current.style.transform = `translate3d(${p}%, 0, 0)`;
    if (inner.current) inner.current.style.transform = `translate3d(${-p}%, 0, 0)`;
    if (line.current) line.current.style.transform = `translate3d(${p}%, 0, 0)`;
  };
  useEffect(() => { paint(55); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let drag: { id: number; x0: number; y0: number; started: boolean } | null = null;
    const toPct = (x: number) => { const b = el.getBoundingClientRect(); return ((x - b.left) / b.width) * 100; };
    // резиновый край: за пределами — сопротивление
    const rubber = (raw: number) => raw < MIN ? MIN - (MIN - raw) * 0.22 : raw > MAX ? MAX + (raw - MAX) * 0.22 : raw;
    const down = (e: PointerEvent) => { drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, started: e.pointerType === 'mouse' }; if (drag.started) { el.setPointerCapture(e.pointerId); paint(rubber(toPct(e.clientX))); } };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.started) {
        const dx = Math.abs(e.clientX - drag.x0); const dy = Math.abs(e.clientY - drag.y0);
        if (dy > dx && dy > 6) { drag = null; return; } // вертикально — это скролл страницы
        if (dx < 6) return;
        drag.started = true; el.setPointerCapture(e.pointerId);
      }
      paint(rubber(toPct(e.clientX)));
    };
    const up = () => {
      if (!drag) return;
      drag = null;
      const p = Math.min(MAX, Math.max(MIN, pos.current));
      paint(p, true);
      setAria(Math.round(p));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, []);

  const key = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : e.key === 'Home' ? -100 : e.key === 'End' ? 100 : 0;
    if (!step) return;
    e.preventDefault();
    const p = Math.min(MAX, Math.max(MIN, pos.current + step));
    paint(p, true); setAria(Math.round(p));
  };

  return (
    <div className="ba">
      <div
        className="ba-stage" ref={stage} role="slider" tabIndex={0} aria-label="Сравнить до и после" aria-valuemin={0} aria-valuemax={100} aria-valuenow={aria}
        aria-valuetext={`показано «после» на ${100 - aria}%`} onKeyDown={key}
      >
        <div className="ba-layer ba-before">
          {!lazy && <IsoApartment plan={plan} layers={BEFORE} level="economy" assembled detail="low" stagger={0} title="До ремонта: голые стены и плита" />}
        </div>
        <div className="ba-after-wrap" ref={wrap}>
          <div className="ba-layer ba-after" ref={inner}>
            {!lazy && <IsoApartment plan={plan} layers={after} level={project.level} type={project.type} assembled detail="low" stagger={0} title="После ремонта" />}
          </div>
        </div>
        <span className="ba-line" ref={line} aria-hidden="true"><span className="ba-bar"><span className="ba-knob" /></span></span>
        <span className="ba-tag ba-tag-l mono">до</span>
        <span className="ba-tag ba-tag-r mono">после</span>
      </div>
      <p className="micro muted">Потяните за ручку.</p>
    </div>
  );
}
