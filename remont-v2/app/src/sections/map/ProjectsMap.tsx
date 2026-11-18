import { useEffect, useMemo, useRef, useState } from 'react';
import { api, catalog, type DistrictId, type Project, type RenovationType } from '../../api';
import { BeforeAfter } from '../../components/BeforeAfter';
import { Icon } from '../../components/Icon';
import { MapNN, districtName } from '../../components/map/MapNN';
import { useApi, useInView, useMedia } from '../../lib/hooks';
import { rub, area, weeks } from '../../lib/format';
import { scrollToId, useCalc } from '../../state/calc';
import './projects.css';

function ProjectCard({ p, onWant, lazy }: { p: Project; onWant: (p: Project) => void; lazy?: boolean }) {
  return (
    <article className="pc">
      <header className="pc-head">
        <span className="mono pc-where">{districtName(p.district)} · {p.street}</span>
      </header>
      <h3 className="pc-title display">{p.title}</h3>
      <BeforeAfter project={p} lazy={lazy} />
      <dl className="pc-facts">
        <div><dt>Дом</dt><dd>{catalog.houseTypes.find((h) => h.id === p.house)!.name}, {p.rooms}-комн.</dd></div>
        <div><dt>Площадь</dt><dd className="num">{area(p.area)}</dd></div>
        <div><dt>Ремонт</dt><dd>{catalog.renovationTypes.find((t) => t.id === p.type)!.name}</dd></div>
        <div><dt>Срок</dt><dd className="num">{weeks(p.weeks)}</dd></div>
        <div className="pc-price"><dt>Итог по договору</dt><dd className="num">{rub(p.price)}</dd></div>
      </dl>
      <p className="small muted pc-note">{p.note}</p>
      <button className="btn btn-primary btn-arrow btn-block" onClick={() => onWant(p)}>Хочу так же <Icon name="arrow" /></button>
      <p className="micro muted">Калькулятор откроется с параметрами этого объекта — по сегодняшним ценам.</p>
    </article>
  );
}

export function ProjectsMap() {
  const { data: projects, loading } = useApi(() => api.projects.list(), [], ['projects']);
  const { applyProject } = useCalc();
  const [district, setDistrict] = useState<DistrictId | 'all'>('all');
  const [type, setType] = useState<RenovationType | 'all'>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const desktop = useMedia('(min-width: 1000px)');
  const [mapRef, mapIn] = useInView<HTMLDivElement>({ margin: '0px 0px -20% 0px' });
  const rail = useRef<HTMLDivElement>(null);
  const programmatic = useRef(0);

  const filtered = useMemo(() => (projects ?? []).filter((p) => (district === 'all' || p.district === district) && (type === 'all' || p.type === type)), [projects, district, type]);
  const visible = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);
  const counts = useMemo(() => {
    const c: Partial<Record<DistrictId, number>> = {};
    (projects ?? []).filter((p) => type === 'all' || p.type === type).forEach((p) => { c[p.district] = (c[p.district] ?? 0) + 1; });
    return c;
  }, [projects, type]);
  const active = filtered.find((p) => p.id === activeId) ?? null;
  const activeIdx = filtered.findIndex((p) => p.id === activeId);

  useEffect(() => { if (!active && filtered.length) setActiveId(filtered[0].id); }, [active, filtered]);

  // телефон: карточка, которая встала в центр ленты, становится активной — пин подсвечивается синхронно
  useEffect(() => {
    if (desktop || !rail.current) return;
    const io = new IntersectionObserver((entries) => {
      if (Date.now() < programmatic.current) return;
      const best = entries.filter((e) => e.isIntersecting && e.intersectionRatio > 0.6).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (best) setActiveId((best.target as HTMLElement).dataset.id ?? null);
    }, { root: rail.current, threshold: [0.6, 0.8, 1] });
    rail.current.querySelectorAll('[data-id]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [desktop, filtered]);

  const pick = (p: Project) => {
    setActiveId(p.id);
    if (!desktop && rail.current) {
      const card = rail.current.querySelector<HTMLElement>(`[data-id="${p.id}"]`);
      if (card) {
        programmatic.current = Date.now() + 700;
        rail.current.scrollTo({ left: card.offsetLeft - rail.current.offsetLeft - 16, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
  };
  const want = (p: Project) => { applyProject(p); scrollToId('calc'); };

  return (
    <section className="sheet objects" id="objects" aria-labelledby="objects-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-06</b><span>Объекты на карте</span><i /><span>{projects ? `${projects.length} примеров` : ''}</span></div>
        <div className="obj-head">
          <h2 id="objects-title" className="display h2 rv">Ремонты <em>рядом с вами</em></h2>
          <p className="lead rv">Объекты по районам: тип дома, площадь, срок и итоговая цена.</p>
        </div>

        <div className="obj-filters">
          <div className="chips obj-chips strip-mask strip-mask-d-off" role="radiogroup" aria-label="Район">
            <button className="chip" role="radio" aria-checked={district === 'all'} onClick={() => setDistrict('all')}>Все районы</button>
            {catalog.districts.map((d) => <button key={d.id} className="chip" role="radio" aria-checked={district === d.id} onClick={() => setDistrict(d.id)}>{d.name}</button>)}
          </div>
          <div className="chips obj-chips strip-mask strip-mask-d-off" role="radiogroup" aria-label="Тип ремонта">
            <button className="chip" role="radio" aria-checked={type === 'all'} onClick={() => setType('all')}>Любой ремонт</button>
            {catalog.renovationTypes.map((t) => <button key={t.id} className="chip" role="radio" aria-checked={type === t.id} onClick={() => setType(t.id)}>{t.name}</button>)}
          </div>
        </div>

        <div className="obj-grid">
          <div className="obj-map" ref={mapRef}>
            <MapNN projects={projects ?? []} visible={visible} entered={mapIn} district={district} activeId={active?.id ?? null} onPick={pick} onDistrict={(d) => { setDistrict(d); setActiveId(null); }} counts={counts} />
            <span className="obj-legend mono"><span className="dot" /> схема, не в масштабе</span>
          </div>

          <div className="obj-card" aria-live="polite">
            {loading && <p className="muted">Загружаем объекты…</p>}
            {!loading && filtered.length === 0 && (
              <div className="obj-empty">
                <Icon name="pin" size={28} />
                <b>{district !== 'all' ? `В районе «${districtName(district)}» пока нет примеров` : 'Нет примеров'}{type !== 'all' ? ' такого ремонта' : ''}</b>
                <p className="small muted">Посмотрите соседние районы или посчитайте свою квартиру — работаем по всему городу.</p>
                <div className="chips">
                  <button className="chip" onClick={() => { setDistrict('all'); setType('all'); }}>Показать все</button>
                  <button className="chip" onClick={() => scrollToId('calc')}>К калькулятору</button>
                </div>
              </div>
            )}
            {desktop && active && <div key={active.id} className="pc-swap"><ProjectCard p={active} onWant={want} /></div>}
            {!desktop && filtered.length > 0 && (
              <>
                <div className="pc-rail" ref={rail} aria-label="Объекты, листайте">
                  {filtered.map((p, i) => (
                    <div key={p.id} className={`pc-slide${p.id === activeId ? ' on' : ''}`} data-id={p.id}>
                      <ProjectCard p={p} onWant={want} lazy={Math.abs(i - Math.max(0, activeIdx)) > 1} />
                    </div>
                  ))}
                </div>
                <div className="pc-dots" aria-hidden="true">
                  {filtered.map((p) => <span key={p.id} className={p.id === activeId ? 'on' : ''} />)}
                </div>
              </>
            )}
          </div>
        </div>

        {desktop && filtered.length > 0 && (
          <ul className="obj-list strip-mask" aria-label="Список объектов">
            {filtered.map((p) => (
              <li key={p.id}>
                <button className={`ol${p.id === active?.id ? ' on' : ''}`} onClick={() => pick(p)} aria-pressed={p.id === active?.id}>
                  <span className="mono ol-d">{districtName(p.district)}</span>
                  <span className="ol-t">{p.title}</span>
                  <span className="num small muted">{area(p.area)} · {rub(p.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
