import { useEffect, useState } from 'react';
import { api, catalog, type CalcParams, type Estimate, type PriceSettings, type RenovationType, type HouseTypeId } from '../api';
import { Icon } from '../components/Icon';
import { Segmented, Spinner, useToast } from '../components/ui';
import { humanError, useApi } from '../lib/hooks';
import { rub, num } from '../lib/format';
import { AdmHead, NumField } from './AdminApp';

export function Prices() {
  const { data: saved } = useApi(() => api.estimates.getSettings(), [], ['settings']);
  const [d, setD] = useState<PriceSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => { if (saved) setD(saved); }, [saved]);
  if (!d || !saved) return <div className="adm-page muted">Загружаем цены…</div>;

  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const paySum = d.payments.reduce((a, p) => a + Number(p.percent || 0), 0);
  const upd = (patch: Partial<PriceSettings>) => setD({ ...d, ...patch });
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.estimates.saveSettings(d); toast('Цены сохранены — сайт уже считает по-новому', 'ok'); } catch (e) { setErr(humanError(e)); } finally { setBusy(false); }
  };
  const types = catalog.renovationTypes;

  return (
    <div className="adm-page">
      <AdmHead title="Цены" sub="Все деньги на сайте считаются отсюда: калькулятор, бюджеты, смета, PDF.">
        <button className="btn btn-s btn-quiet" onClick={() => setD(saved)} disabled={!dirty}>Отменить</button>
        <button className="btn btn-s btn-primary" onClick={save} disabled={!dirty || busy}>{busy ? <Spinner /> : <Icon name="check" size={16} />} Сохранить</button>
      </AdmHead>
      {err && <p className="err" role="alert">{err}</p>}
      {dirty && <p className="dirty-note small"><Icon name="info" size={14} /> Есть несохранённые изменения. Превью справа уже показывает новые цифры.</p>}

      <div className="prices">
        <div className="prices-form">
          <section className="adm-card">
            <h2 className="adm-h2">Работы и материалы, ₽/м²</h2>
            <div className="ptable">
              <span /><span className="mono">Работы</span><span className="mono">Материалы</span>
              {types.map((t) => (
                <PRow key={t.id} label={t.name}>
                  <NumField label={`Работы, ${t.name}`} value={d.worksPerM2[t.id]} onChange={(n) => upd({ worksPerM2: { ...d.worksPerM2, [t.id]: n } })} suffix="₽" />
                  <NumField label={`Материалы, ${t.name}`} value={d.materialsPerM2[t.id]} onChange={(n) => upd({ materialsPerM2: { ...d.materialsPerM2, [t.id]: n } })} suffix="₽" />
                </PRow>
              ))}
            </div>
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Коэффициент дома</h2>
            <p className="small muted">Умножает стоимость работ: в старом фонде больше черновых.</p>
            <div className="nf-grid">
              {catalog.houseTypes.map((h) => (
                <NumField key={h.id} label={h.name} value={d.houseCoef[h.id]} step={0.01} onChange={(n) => upd({ houseCoef: { ...d.houseCoef, [h.id]: n } })} suffix="×" max={3} />
              ))}
            </div>
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Уровни материалов</h2>
            <div className="ptable">
              <span /><span className="mono">× работы</span><span className="mono">× материалы</span>
              {catalog.budgetLevels.map((l) => (
                <PRow key={l.id} label={l.name}>
                  <NumField label={`${l.name}: работы`} value={d.budget[l.id].works} step={0.01} max={5} onChange={(n) => upd({ budget: { ...d.budget, [l.id]: { ...d.budget[l.id], works: n } } })} suffix="×" />
                  <NumField label={`${l.name}: материалы`} value={d.budget[l.id].materials} step={0.01} max={5} onChange={(n) => upd({ budget: { ...d.budget, [l.id]: { ...d.budget[l.id], materials: n } } })} suffix="×" />
                </PRow>
              ))}
            </div>
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Санузел, за каждый</h2>
            <div className="ptable">
              <span /><span className="mono">Работы</span><span className="mono">Материалы</span>
              {types.map((t) => (
                <PRow key={t.id} label={t.name}>
                  <NumField label={`Санузел работы, ${t.name}`} value={d.bathroom[t.id].works} onChange={(n) => upd({ bathroom: { ...d.bathroom, [t.id]: { ...d.bathroom[t.id], works: n } } })} suffix="₽" />
                  <NumField label={`Санузел материалы, ${t.name}`} value={d.bathroom[t.id].materials} onChange={(n) => upd({ bathroom: { ...d.bathroom, [t.id]: { ...d.bathroom[t.id], materials: n } } })} suffix="₽" />
                </PRow>
              ))}
            </div>
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Опции и прочее</h2>
            <div className="nf-grid">
              {catalog.options.map((o) => (
                <NumField key={o.id} label={`${o.name} (${o.unit === 'perM2' ? 'за м²' : o.unit === 'perRoom' ? 'за комнату' : 'фикс.'})`} value={d.options[o.id]} onChange={(n) => upd({ options: { ...d.options, [o.id]: n } })} suffix="₽" />
              ))}
              <NumField label="Двери и проёмы, за комнату" value={d.perRoom} onChange={(n) => upd({ perRoom: n })} suffix="₽" />
              <NumField label="Вывоз мусора, за м²" value={d.debrisPerM2} onChange={(n) => upd({ debrisPerM2: n })} suffix="₽" />
              <NumField label="Минимальная площадь" value={d.minArea} onChange={(n) => upd({ minArea: n })} suffix="м²" />
              <NumField label="Максимальная площадь" value={d.maxArea} onChange={(n) => upd({ maxArea: n })} suffix="м²" />
            </div>
          </section>

          <section className="adm-card">
            <h2 className="adm-h2">Оплата по этапам</h2>
            <p className={`small ${paySum === 100 ? 'muted' : 'err'}`}>Сумма: {paySum}% {paySum === 100 ? '— всё сходится' : '— должно быть ровно 100%'}</p>
            <div className="pay-edit">
              {d.payments.map((p, i) => (
                <div key={p.id} className="pay-row">
                  <NumField label="%" value={p.percent} max={100} onChange={(n) => upd({ payments: d.payments.map((x, j) => (j === i ? { ...x, percent: n } : x)) })} suffix="%" />
                  <label className="nf nf-wide"><span>Когда</span>
                    <input className="input" value={p.after} onChange={(e) => upd({ payments: d.payments.map((x, j) => (j === i ? { ...x, after: e.target.value } : x)) })} />
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="prices-preview">
          <BeforeAfterTypical draft={d} />
          <LivePreview draft={d} />
        </aside>
      </div>
    </div>
  );
}

function PRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <><span className="ptable-l">{label}</span>{children}</>;
}

function useDebounced<T>(v: T, ms = 220) {
  const [s, setS] = useState(v);
  useEffect(() => { const t = window.setTimeout(() => setS(v), ms); return () => window.clearTimeout(t); }, [v, ms]);
  return s;
}

function BeforeAfterTypical({ draft }: { draft: PriceSettings }) {
  const dd = useDebounced(draft);
  const [r, setR] = useState<{ before: Estimate; after: Estimate } | null>(null);
  useEffect(() => { let on = true; api.estimates.typicalBeforeAfter(dd).then((x) => on && setR(x)); return () => { on = false; }; }, [dd]);
  const diff = r ? r.after.total - r.before.total : 0;
  return (
    <section className="adm-card pv">
      <h2 className="adm-h2">Типовая двушка: было → стало</h2>
      <p className="small muted">Брежневка, 54,5 м², капитальный, «Стандарт», демонтаж и электрика</p>
      {r && (
        <>
          <div className="pv-ba">
            <div><span className="mono">было</span><b className="num">{rub(r.before.total)}</b><span className="small muted num">{num(r.before.perM2)} ₽/м²</span></div>
            <Icon name="arrow" />
            <div><span className="mono">станет</span><b className="num">{rub(r.after.total)}</b><span className="small muted num">{num(r.after.perM2)} ₽/м²</span></div>
          </div>
          <p className={`pv-diff num ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>{diff === 0 ? 'Без изменений' : `${diff > 0 ? '+' : '−'}${rub(Math.abs(diff))} (${diff > 0 ? '+' : '−'}${Math.abs((diff / r.before.total) * 100).toFixed(1).replace('.', ',')}%)`}</p>
          <table className="lc-table">
            <tbody>
              {r.after.lines.map((l) => {
                const b = r.before.lines.find((x) => x.id === l.id)?.amount ?? 0;
                return <tr key={l.id}><th scope="row">{l.title}</th><td className="num muted">{rub(b)}</td><td className="num">{rub(l.amount)}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function LivePreview({ draft }: { draft: PriceSettings }) {
  const dd = useDebounced(draft);
  const [p, setP] = useState<CalcParams>({ area: 60, house: 'panel90', rooms: 2, bathrooms: 1, type: 'capital', level: 'standard', options: [] });
  const [e, setE] = useState<Estimate | null>(null);
  useEffect(() => { let on = true; api.estimates.calculate(p, { settings: dd }).then((x) => on && setE(x)); return () => { on = false; }; }, [p, dd]);
  return (
    <section className="adm-card pv">
      <h2 className="adm-h2">Превью калькулятора</h2>
      <Segmented label="Тип" value={p.type} options={catalog.renovationTypes.map((t) => ({ value: t.id as RenovationType, label: t.short }))} onChange={(v) => setP({ ...p, type: v })} />
      <div className="chips">
        {catalog.houseTypes.map((h) => <button key={h.id} className="chip" aria-pressed={p.house === h.id} onClick={() => setP({ ...p, house: h.id as HouseTypeId })}>{h.name}</button>)}
      </div>
      <label className="nf"><span>Площадь: {p.area} м²</span>
        <input type="range" className="range" min={draft.minArea} max={Math.min(draft.maxArea, 150)} value={p.area} style={{ '--p': `${((p.area - draft.minArea) / (Math.min(draft.maxArea, 150) - draft.minArea)) * 100}%` } as React.CSSProperties} onChange={(ev) => setP({ ...p, area: Number(ev.target.value) })} />
      </label>
      {e && <div className="pv-res"><b className="display num">от {rub(e.total)}</b><span className="small muted num">{num(e.perM2)} ₽/м² · {e.weeks.min}–{e.weeks.max} нед.</span></div>}
    </section>
  );
}
