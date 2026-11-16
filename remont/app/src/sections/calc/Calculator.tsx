import { useEffect, useState } from 'react';
import { api, catalog, type OptionId, type PriceSettings } from '../../api';
import { IsoApartment } from '../../components/iso/IsoApartment';
import type { LayerKey } from '../../components/iso/engine';
import { Icon } from '../../components/Icon';
import { Rolling, Segmented, useMagnet, useToast } from '../../components/ui';
import { useApi, useInView } from '../../lib/hooks';
import { area as fmtArea, num, rub, weeks } from '../../lib/format';
import { shareEstimate } from '../../lib/share';
import { scrollToId, useCalc } from '../../state/calc';
import './calc.css';

const LEGEND: { key: LayerKey; label: string; when: (l: Record<string, boolean>) => boolean; note?: string }[] = [
  { key: 'screed', label: 'Стяжка', when: (l) => l.screed },
  { key: 'partitions', label: 'Перегородки', when: () => true },
  { key: 'electrics', label: 'Электрика', when: (l) => l.electrics },
  { key: 'warmFloor', label: 'Тёплый пол', when: (l) => l.warmFloor },
  { key: 'walls', label: 'Отделка стен', when: () => true },
  { key: 'floor', label: 'Пол', when: () => true },
  { key: 'light', label: 'Свет', when: () => true },
  { key: 'furniture', label: 'Мебель', when: () => true, note: 'для наглядности, в смету не входит' },
  { key: 'conditioner', label: 'Кондиционер', when: (l) => l.conditioner },
];

const PRESETS = [32, 45, 55, 75, 100];

function optionPrice(id: OptionId, s?: PriceSettings) {
  if (!s) return '';
  const def = catalog.options.find((o) => o.id === id)!;
  const v = s.options[id];
  return def.unit === 'perM2' ? `${num(v)} ₽/м²` : def.unit === 'perRoom' ? `${num(v)} ₽/комн.` : `${num(v)} ₽`;
}

export function Calculator() {
  const { params, estimate, plan, set, openEstimate, origin } = useCalc();
  const toast = useToast();
  const magnet = useMagnet();
  const { data: settings } = useApi(() => api.estimates.getSettings(), [], ['settings']);
  const [ref, inView] = useInView<HTMLDivElement>({ margin: '0px 0px -25% 0px' });
  const [focus, setFocus] = useState<LayerKey | null>(null);
  const [areaText, setAreaText] = useState(String(params.area).replace('.', ','));
  const [areaErr, setAreaErr] = useState<string | null>(null);
  const min = settings?.minArea ?? 18; const max = settings?.maxArea ?? 250;

  useEffect(() => { setAreaText(String(params.area).replace('.', ',')); setAreaErr(null); }, [params.area]);

  const commitArea = () => {
    const v = Number(areaText.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(v) || v < min || v > max) {
      setAreaErr(`Площадь — от ${min} до ${max} м². Для домов и коммерции посчитаем отдельно на замере.`);
      return;
    }
    setAreaErr(null);
    set({ area: Math.round(v * 10) / 10 });
  };
  const toggleOption = (id: OptionId) => set({ options: params.options.includes(id) ? params.options.filter((o) => o !== id) : [...params.options, id] });
  const layers = estimate?.layers ?? { screed: true, partitions: true, electrics: true, warmFloor: false, walls: true, floor: true, light: true, furniture: true, conditioner: false };
  const typeInfo = catalog.renovationTypes.find((t) => t.id === params.type)!;
  const house = catalog.houseTypes.find((h) => h.id === params.house)!;
  const planNote = params.planId && !plan.scaled
    ? `Типовая планировка: ${house.name.toLowerCase()}, ${params.rooms}-комн.`
    : params.planId ? `Планировка подогнана под ${fmtArea(params.area)}` : `Условная планировка: ${house.name.toLowerCase()}, ${params.rooms}-комн.`;
  const pct = ((params.area - min) / (max - min)) * 100;

  return (
    <section className="sheet calc" id="calc" aria-labelledby="calc-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-03</b><span>Калькулятор</span><i /><span>шаг 2 из 3</span></div>
        <div className="calc-head">
          <h2 id="calc-title" className="display h2 rv">Соберите <em>свою квартиру</em></h2>
          <p className="lead rv">Меняйте параметры — квартира собирается слоями, а цена и срок пересчитываются по тем же ставкам, что пойдут в договор.</p>
        </div>

        {/* мини-итог для телефона: всегда видно, сколько выходит */}
        {estimate && (
          <div className="calc-mini" aria-hidden="true">
            <span className="num calc-mini-v"><Rolling value={estimate.total} format={(n) => `от ${rub(n)}`} /></span>
            <span className="mono small">{weeks(estimate.weeks.min, estimate.weeks.max)}</span>
          </div>
        )}

        <div className="calc-grid" ref={ref}>
          <div className="calc-stage">
            <div className="calc-iso">
              <IsoApartment plan={plan} layers={layers} level={params.level} assembled={inView} focus={focus} stagger={190} title={`Квартира ${fmtArea(params.area)} собирается по слоям ремонта`} />
              <span className="calc-plan-note mono">{planNote}</span>
              {estimate && (
                <div className="iso-price" aria-hidden="true">
                  <span className="num"><Rolling value={estimate.total} format={(n) => `от ${rub(n)}`} /></span>
                  <span className="mono">{weeks(estimate.weeks.min, estimate.weeks.max)} · {num(estimate.perM2)} ₽/м²</span>
                </div>
              )}
              {origin === 'map' && <span className="calc-origin tag tag-clay">как в проекте с карты</span>}
            </div>
            <ul className="legend" aria-label="Слои ремонта">
              {LEGEND.filter((x) => x.key !== 'warmFloor' || layers.warmFloor).filter((x) => x.key !== 'conditioner' || layers.conditioner).map((x, i) => {
                const on = x.when(layers as unknown as Record<string, boolean>);
                return (
                  <li key={x.key}>
                    <button
                      className={`lg${on ? ' on' : ''}${focus === x.key ? ' focus' : ''}`}
                      aria-pressed={focus === x.key}
                      disabled={!on}
                      onClick={() => setFocus(focus === x.key ? null : x.key)}
                      title={x.note}
                    >
                      <span className="lg-i mono">{String(i + 1).padStart(2, '0')}</span>
                      <span>{x.label}{!on && <span className="lg-off"> — не входит</span>}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="micro muted legend-hint">Нажмите на слой, чтобы увидеть его отдельно. Мебель — для наглядности, в смету не входит.</p>
          </div>

          <div className="calc-form">
            <div className="cf-block">
              <label className="cf-k" htmlFor="area-input">Площадь квартиры</label>
              <div className="area-row">
                <input
                  id="area-input" className="area-input num" inputMode="decimal" value={areaText}
                  aria-invalid={!!areaErr} aria-describedby={areaErr ? 'area-err' : undefined}
                  onChange={(e) => setAreaText(e.target.value)} onBlur={commitArea}
                  onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                />
                <span className="area-unit">м²</span>
              </div>
              <input
                type="range" className="range" min={min} max={max} step={0.5} value={params.area}
                style={{ '--p': `${pct}%` } as React.CSSProperties}
                aria-label="Площадь, м²" aria-valuetext={fmtArea(params.area)}
                onChange={(e) => set({ area: Number(e.target.value) })}
              />
              {areaErr && <p className="err" id="area-err" role="alert">{areaErr}</p>}
              <div className="chips chips-s">
                {PRESETS.map((p) => <button key={p} className="chip chip-num" aria-pressed={params.area === p} onClick={() => set({ area: p })}>{p} м²</button>)}
              </div>
            </div>

            <div className="cf-block">
              <span className="cf-k">Тип ремонта</span>
              <Segmented
                label="Тип ремонта" value={params.type}
                options={catalog.renovationTypes.map((t) => ({ value: t.id, label: t.short }))}
                onChange={(v) => set({ type: v })}
                className="cf-seg"
              />
              <p className="small muted cf-hint">{typeInfo.hint}</p>
            </div>

            <div className="cf-block">
              <span className="cf-k">Дом</span>
              <div className="chips" role="radiogroup" aria-label="Тип дома">
                {catalog.houseTypes.map((h) => (
                  <button key={h.id} className="chip" role="radio" aria-checked={params.house === h.id} onClick={() => set({ house: h.id })}>{h.name}</button>
                ))}
              </div>
              {settings && <p className="small muted cf-hint">Коэффициент сложности: ×{String(settings.houseCoef[params.house]).replace('.', ',')} к работам</p>}
            </div>

            <div className="cf-block cf-two">
              <div>
                <span className="cf-k">Комнат</span>
                <div className="chips" role="radiogroup" aria-label="Количество комнат">
                  {[1, 2, 3, 4].map((n) => <button key={n} className="chip chip-num" role="radio" aria-checked={params.rooms === n} onClick={() => set({ rooms: n })}>{n === 4 ? '4+' : n}</button>)}
                </div>
              </div>
              <div>
                <span className="cf-k">Санузлов</span>
                <div className="chips" role="radiogroup" aria-label="Количество санузлов">
                  {[1, 2, 3].map((n) => <button key={n} className="chip chip-num" role="radio" aria-checked={params.bathrooms === n} onClick={() => set({ bathrooms: n })}>{n}</button>)}
                </div>
              </div>
            </div>

            <div className="cf-block">
              <span className="cf-k">Дополнительно</span>
              <div className="cf-options">
                {catalog.options.map((o) => (
                  <button key={o.id} className="toggle" role="switch" aria-checked={params.options.includes(o.id)} onClick={() => toggleOption(o.id)}>
                    <span className="sw" aria-hidden="true" />
                    <span><b>{o.name}</b><small>{o.hint}</small></span>
                    <span className="price num">{optionPrice(o.id, settings)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="cf-block">
              <span className="cf-k">Уровень материалов</span>
              <Segmented
                label="Уровень материалов" value={params.level}
                options={catalog.budgetLevels.map((l) => ({ value: l.id, label: l.name }))}
                onChange={(v) => set({ level: v })}
              />
              <button className="link small cf-compare" onClick={() => scrollToId('budgets')}>Сравнить три бюджета на одной комнате</button>
            </div>
          </div>
        </div>

        <div className="calc-result" aria-live="polite">
          <div className="cr-main">
            <span className="cr-k mono">Итого под ключ, с материалами</span>
            <span className="cr-total display num">
              {estimate ? <Rolling value={estimate.total} format={(n) => `от ${rub(n)}`} /> : '…'}
            </span>
          </div>
          <dl className="cr-facts">
            <div><dt>за м²</dt><dd className="num">{estimate ? <Rolling value={estimate.perM2} format={(n) => rub(n)} /> : '—'}</dd></div>
            <div><dt>срок</dt><dd className="num">{estimate ? weeks(estimate.weeks.min, estimate.weeks.max) : '—'}</dd></div>
            <div><dt>материалы</dt><dd className="num">{estimate ? <Rolling value={estimate.materialsTotal} format={(n) => rub(n)} /> : '—'}</dd></div>
          </dl>
          <div className="cr-actions">
            <button className="btn btn-primary btn-arrow" onPointerMove={magnet} disabled={!estimate} onClick={() => { openEstimate(true); window.setTimeout(() => scrollToId('smeta'), 60); }}>
              Открыть смету по этапам <Icon name="arrowDown" />
            </button>
            <button className="btn btn-ghost" disabled={!estimate} onClick={() => estimate && shareEstimate(estimate, toast)}>
              <Icon name="share" size={18} /> Поделиться сметой
            </button>
            <button className="btn btn-quiet" onClick={() => scrollToId('zamer')}>Записаться на замер</button>
          </div>
          <p className="cr-lock small"><Icon name="lock" size={16} /> Цена из калькулятора — «от». Точную смету фиксируем в договоре после бесплатного замера.</p>
        </div>
      </div>
    </section>
  );
}
