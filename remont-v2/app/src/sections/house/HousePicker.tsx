import { useEffect, useMemo, useRef, useState } from 'react';
import { api, catalog, type FloorPlan, type HouseTypeId } from '../../api';
import { HouseFacade } from '../../components/HouseFacade';
import { PlanDrawing, roomAnchor } from '../../components/PlanDrawing';
import { Icon } from '../../components/Icon';
import { Segmented, useMagnet } from '../../components/ui';
import { useApi, useMedia } from '../../lib/hooks';
import { usePinchZoom } from '../../lib/pinch';
import { area } from '../../lib/format';
import { scrollToId, useCalc } from '../../state/calc';
import './house.css';

export function HousePicker() {
  const { applyPlan } = useCalc();
  const magnet = useMagnet();
  const [house, setHouse] = useState<HouseTypeId>('brezhnevka');
  const [rooms, setRooms] = useState(2);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [delta, setDelta] = useState(0); // ±15% к типовой площади
  const desktop = useMedia('(min-width: 1000px)');
  const { data: typical, loading } = useApi(() => api.plans.typical(house, rooms), [house, rooms]);
  const info = catalog.houseTypes.find((h) => h.id === house)!;
  const zoom = usePinchZoom();

  // планировка под «мою квартиру чуть больше/меньше»: площади комнат пересчитываются сервисом
  const plan: FloorPlan | undefined = useMemo(() => {
    if (!typical) return undefined;
    if (delta === 0) return typical;
    return api.plans.forParams({ house, rooms, bathrooms: typical.bathrooms, area: Math.round(typical.area * (1 + delta / 100) * 10) / 10, planId: typical.id });
  }, [typical, delta, house, rooms]);

  // плавная смена: старая планировка гаснет поверх, новая прорисовывается линиями
  const [prev, setPrev] = useState<FloorPlan | null>(null);
  const shown = useRef<FloorPlan | undefined>(undefined);
  useEffect(() => {
    if (!plan) return;
    const old = shown.current;
    shown.current = plan;
    if (old && old.id !== plan.id) {
      setPrev(old);
      const t = window.setTimeout(() => setPrev(null), 420);
      return () => window.clearTimeout(t);
    }
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSel(null); setHover(null); setDelta(0); zoom.reset(); }, [house, rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeId = hover ?? sel;
  const activeRoom = plan?.items.find((r) => r.id === activeId && r.kind !== 'balcony');
  const tip = activeRoom ? api.plans.roomTip(house, activeRoom.kind) : '';
  const anchor = plan && activeRoom && desktop ? roomAnchor(plan, activeRoom.id) : null;

  return (
    <section className="sheet house" id="dom" aria-labelledby="dom-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-02</b><span>Типовые планировки Нижнего</span><i /><span>шаг 1 из 3</span></div>
        <div className="house-head giant-wrap"><div className="giant-text"><h2 id="dom-title" className="display h2 rv">Выберите <em>ваш дом</em></h2><p className="lead rv">Хрущёвка, сталинка или новостройка — у каждой свои стены, полы и проводка. Найдите свою планировку и посчитайте ремонт именно для неё.</p></div><span className="giant" aria-hidden="true">02</span></div>

        <div className="house-types strip-mask strip-mask-d-off" role="radiogroup" aria-label="Тип дома">
          {catalog.houseTypes.map((h) => (
            <button key={h.id} role="radio" aria-checked={house === h.id} className={`house-card${house === h.id ? ' on' : ''}`} onClick={() => setHouse(h.id)}>
              <HouseFacade type={h.id} lit={house === h.id} />
              <span className="house-name">{h.name}</span>
              <span className="house-years mono">{h.years}</span>
            </button>
          ))}
        </div>

        <div className="house-body">
          <div className="house-side">
            <span className="field-k">Сколько комнат</span>
            <Segmented label="Количество комнат" value={rooms} options={[1, 2, 3].map((n) => ({ value: n, label: `${n}-комнатная` }))} onChange={setRooms} className="house-seg" />
            <p className="house-note small"><Icon name="info" size={16} /> {info.note}</p>

            {typical && (
              <div className="house-size">
                <span className="field-k">Моя квартира чуть {delta >= 0 ? 'больше' : 'меньше'}</span>
                <input
                  type="range" className="range" min={-15} max={15} step={1} value={delta}
                  style={{ '--p': `${((delta + 15) / 30) * 100}%` } as React.CSSProperties}
                  aria-label="Площадь относительно типовой, %" aria-valuetext={`${delta > 0 ? '+' : ''}${delta}% — ${plan ? area(plan.area) : ''}`}
                  onChange={(e) => setDelta(Number(e.target.value))}
                />
                <div className="house-size-scale mono"><span>−15%</span><span>{delta === 0 ? 'типовая' : `${delta > 0 ? '+' : ''}${delta}%`}</span><span>+15%</span></div>
              </div>
            )}

            {plan && (
              <ul className="house-rooms" aria-label="Комнаты">
                {plan.items.map((r) => (
                  <li key={r.id}>
                    <button
                      className={`hr-row${activeId === r.id ? ' on' : ''}`} aria-pressed={sel === r.id}
                      onClick={() => setSel(sel === r.id ? null : r.id)}
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(r.id); }}
                      onPointerLeave={() => setHover(null)}
                    >
                      <span>{r.name}{r.kind === 'balcony' && <span className="muted"> · не входит в площадь</span>}</span>
                      <span className="num mono">{area(r.area)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {plan && (
              <div className="house-total">
                <span className="small muted">Общая площадь</span>
                <span className="num house-total-v">≈ {area(plan.area)}</span>
                <span className="small muted">потолки {String(info.ceiling).replace('.', ',')} м · санузлов: {plan.bathrooms}</span>
              </div>
            )}
            <button className="btn btn-primary btn-arrow btn-block" disabled={!plan} onPointerMove={magnet} onClick={() => { if (plan) { applyPlan(plan); scrollToId('calc'); } }}>
              Рассчитать эту квартиру <Icon name="arrow" />
            </button>
          </div>

          <figure className="house-plan" aria-busy={loading}>
            <div className="house-paper" ref={zoom.ref}>
              <div className="pz" ref={zoom.inner}>
                {plan && <PlanDrawing plan={plan} selected={sel} hovered={hover} onSelect={setSel} onHover={setHover} drawKey={`${house}-${rooms}`} />}
                {prev && <div className="plan-out" aria-hidden="true"><PlanDrawing plan={prev} animate={false} /></div>}
              </div>
              {anchor && activeRoom && (
                <div className={`room-tip${anchor.left > 68 ? ' tip-left' : anchor.left < 32 ? ' tip-right' : ''}${anchor.top < 22 ? ' tip-below' : ''}`} style={{ left: `${anchor.left}%`, top: `${anchor.top}%` }} role="status">
                  <b>{activeRoom.name} · <span className="num">{area(activeRoom.area)}</span></b>
                  <span>{tip}</span>
                </div>
              )}
              <div className="pz-ctrl" aria-label="Масштаб чертежа">
                <button onClick={() => zoom.step(1)} aria-label="Приблизить"><Icon name="plus" size={18} /></button>
                <button onClick={() => zoom.step(-1)} aria-label="Отдалить" disabled={!zoom.zoomed}><Icon name="minus" size={18} /></button>
              </div>
              <div className="house-stamp mono" aria-hidden="true">
                <span>Метр</span><span>{info.name}, {rooms}-комн.</span><span>типовая планировка, примерно</span><span>М 1:100</span>
              </div>
            </div>
            <figcaption className="small muted house-cap">
              {activeRoom ? (
                desktop ? <>Наведите на другую комнату или нажмите, чтобы закрепить выбор.</> : <span className="cap-room"><b className="house-sel">{activeRoom.name} — {area(activeRoom.area)}.</b> {tip}</span>
              ) : (
                <>Типовая планировка, примерно. {desktop ? 'Наведите на комнату' : 'Нажмите на комнату'} — покажем площадь и что в ней обычно делают при ремонте. <span className="pz-hint">Чертёж можно приблизить двумя пальцами.</span></>
              )}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
