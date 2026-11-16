import { useEffect, useMemo, useState } from 'react';
import { api, type CalcParams } from '../../api';
import { layersFor } from '../../api/pricing';
import { IsoApartment } from '../../components/iso/IsoApartment';
import { Icon } from '../../components/Icon';
import { useMagnet } from '../../components/ui';
import { useApi } from '../../lib/hooks';
import { rub, num, area } from '../../lib/format';
import { scrollToId } from '../../state/calc';
import { useNearest, useTexts } from '../shared';
import './hero.css';

const HERO: CalcParams = { area: 63.6, house: 'novostroyka', rooms: 2, bathrooms: 2, type: 'capital', level: 'standard', options: ['electrics', 'warmFloor'] };

export function Hero() {
  const texts = useTexts();
  const nearest = useNearest();
  const magnet = useMagnet();
  const plan = useMemo(() => api.plans.forParams(HERO), []);
  const layers = useMemo(() => layersFor(HERO), []);
  const [go, setGo] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setGo(true), 250); return () => window.clearTimeout(t); }, []);
  const { data: est } = useApi(() => api.estimates.calculate(HERO), [], ['settings']);
  const { data: from } = useApi(() => api.estimates.priceFrom(), [], ['settings']);

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-text">
          <div className="sheet-label hero-label">
            <b>Л-01</b><span>Ремонт квартир · Нижний Новгород</span><i />
          </div>
          <h1 id="hero-title" className="display hero-h1">
            {texts ? <>{texts.heroTitle} <em>{texts.heroAccent}</em></> : <span className="hero-ph">&nbsp;</span>}
          </h1>
          <p className="lead hero-lead">{texts?.heroLead}</p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-arrow" onPointerMove={magnet} onClick={() => scrollToId('calc')}>
              Рассчитать ремонт <Icon name="arrow" />
            </button>
            <button className="btn btn-ghost hero-zamer" onPointerMove={magnet} onClick={() => scrollToId('zamer')}>Записаться на замер</button>
          </div>
          <button className="near-chip" onClick={() => scrollToId('zamer')} aria-label={nearest.text || 'Ближайший замер'}>
            <span className="near-dot" aria-hidden="true" />
            <span className="near-long">{nearest.loading ? 'Ищем ближайшее окно…' : nearest.text}</span><span className="near-short">{nearest.short}</span>
            <span className="near-free mono">бесплатно</span>
          </button>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-iso">
            <IsoApartment plan={plan} layers={layers} level="standard" assembled={go} stagger={260} title="Квартира собирается: стяжка, стены, пол, свет, мебель" />
          </div>
          <div className="hero-dim hero-dim-a mono">А — {area(plan.area)}</div>
          <div className="hero-dim hero-dim-b mono">М 1:100 · новостройка, 2 комн.</div>
          {est && (
            <div className="hero-tag">
              <span className="mono hero-tag-k">Смета · капитальный</span>
              <span className="hero-tag-v num">{rub(est.total)}</span>
              <span className="hero-tag-s small muted num">{num(est.perM2)} ₽/м² · {est.weeks.min}–{est.weeks.max} недель</span>
              <span className="hero-tag-lock small"><Icon name="lock" size={16} /> зафиксирована в договоре</span>
            </div>
          )}
        </div>
      </div>

      <div className="wrap">
        <ol className="hero-promises">
          {texts?.promises.map((p, i) => (
            <li key={i} className="rv">
              <span className="mono hp-n">0{i + 1}</span>
              <b>{p.title}</b>
              <span className="muted small">{p.text}</span>
            </li>
          ))}
          <li className="hp-price rv">
            <span className="mono hp-n">₽/м²</span>
            <b className="num">работы от {from ? num(from.worksPerM2) : '—'} ₽</b>
            <span className="muted small num">под ключ с материалами — от {from ? num(from.turnkeyPerM2) : '—'} ₽/м²</span>
          </li>
        </ol>
      </div>
    </section>
  );
}
