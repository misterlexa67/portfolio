import { useState } from 'react';
import { api, catalog, type HouseTypeId } from '../../api';
import { HouseFacade } from '../../components/HouseFacade';
import { PlanDrawing } from '../../components/PlanDrawing';
import { Icon } from '../../components/Icon';
import { Segmented, useMagnet } from '../../components/ui';
import { useApi } from '../../lib/hooks';
import { area } from '../../lib/format';
import { scrollToId, useCalc } from '../../state/calc';
import './house.css';

export function HousePicker() {
  const { applyPlan } = useCalc();
  const magnet = useMagnet();
  const [house, setHouse] = useState<HouseTypeId>('brezhnevka');
  const [rooms, setRooms] = useState(2);
  const [sel, setSel] = useState<string | null>(null);
  const { data: plan, loading } = useApi(() => api.plans.typical(house, rooms), [house, rooms]);
  const info = catalog.houseTypes.find((h) => h.id === house)!;
  const selRoom = plan?.items.find((r) => r.id === sel);

  return (
    <section className="sheet house" id="dom" aria-labelledby="dom-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-02</b><span>Типовые планировки Нижнего</span><i /><span>шаг 1 из 3</span></div>
        <div className="house-head giant-wrap"><div className="giant-text"><h2 id="dom-title" className="display h2 rv">Выберите <em>ваш дом</em></h2><p className="lead rv">Хрущёвка, сталинка или новостройка — у каждой свои стены, полы и проводка. Найдите свою планировку и посчитайте ремонт именно для неё.</p></div><span className="giant" aria-hidden="true">02</span>
        </div>

        <div className="house-types strip-mask strip-mask-d-off" role="radiogroup" aria-label="Тип дома">
          {catalog.houseTypes.map((h) => (
            <button
              key={h.id} role="radio" aria-checked={house === h.id}
              className={`house-card${house === h.id ? ' on' : ''}`}
              onClick={() => { setHouse(h.id); setSel(null); }}
            >
              <HouseFacade type={h.id} lit={house === h.id} />
              <span className="house-name">{h.name}</span>
              <span className="house-years mono">{h.years}</span>
            </button>
          ))}
        </div>

        <div className="house-body">
          <div className="house-side">
            <span className="field-k">Сколько комнат</span>
            <Segmented
              label="Количество комнат" value={rooms}
              options={[1, 2, 3].map((n) => ({ value: n, label: `${n}-комнатная` }))}
              onChange={(n) => { setRooms(n); setSel(null); }}
              className="house-seg"
            />
            <p className="house-note small"><Icon name="info" size={16} /> {info.note}</p>

            {plan && (
              <ul className="house-rooms" aria-label="Комнаты">
                {plan.items.map((r) => (
                  <li key={r.id}>
                    <button className={`hr-row${sel === r.id ? ' on' : ''}`} onClick={() => setSel(sel === r.id ? null : r.id)} aria-pressed={sel === r.id}>
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
            <button
              className="btn btn-primary btn-arrow btn-block" disabled={!plan} onPointerMove={magnet}
              onClick={() => { if (plan) { applyPlan(plan); scrollToId('calc'); } }}
            >
              Рассчитать эту квартиру <Icon name="arrow" />
            </button>
          </div>

          <figure className="house-plan" aria-busy={loading}>
            <div className="house-paper">
              {plan && <PlanDrawing plan={plan} selected={sel} onSelect={setSel} />}
              <div className="house-stamp mono" aria-hidden="true">
                <span>Метр</span><span>{info.name}, {rooms}-комн.</span><span>типовая планировка, примерно</span><span>М 1:100</span>
              </div>
            </div>
            <figcaption className="small muted">
              {selRoom ? <><b className="house-sel">{selRoom.name}</b> — {area(selRoom.area)}. Нажмите на другую комнату или ещё раз, чтобы снять выделение.</> : 'Типовая планировка, примерно. Нажмите на комнату, чтобы увидеть её площадь.'}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
