import { useEffect, useState } from 'react';
import { api, catalog, type BudgetLevel } from '../../api';
import { IsoRoom } from '../../components/iso/IsoRoom';
import { Icon } from '../../components/Icon';
import { Rolling } from '../../components/ui';
import { useApi } from '../../lib/hooks';
import { rub, num } from '../../lib/format';
import { scrollToId, useCalc } from '../../state/calc';
import './budgets.css';

const LEVELS: BudgetLevel[] = ['economy', 'standard', 'premium'];
const ROWS: { key: keyof (typeof catalog.budgetLevels)[number]['includes']; label: string }[] = [
  { key: 'floor', label: 'Пол' },
  { key: 'walls', label: 'Стены' },
  { key: 'light', label: 'Свет' },
  { key: 'bath', label: 'Санузел' },
  { key: 'doors', label: 'Двери' },
];

export function Budgets() {
  const { params, set } = useCalc();
  const [level, setLevel] = useState<BudgetLevel>(params.level);
  useEffect(() => setLevel(params.level), [params.level]);
  const key = JSON.stringify({ ...params, level: 'standard' });
  const { data: cmp } = useApi(() => api.estimates.compareBudgets(params), [key], ['settings']);
  const idx = LEVELS.indexOf(level);
  const cur = cmp?.[level];
  const info = catalog.budgetLevels[idx];

  return (
    <section className="sheet budgets" id="budgets" aria-labelledby="budgets-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-05</b><span>Сравнение бюджетов</span><i /><span>одна комната · три уровня</span></div>
        <div className="bud-head giant-wrap"><div className="giant-text"><h2 id="budgets-title" className="display h2 rv">Один интерьер <em>в трёх бюджетах</em></h2><p className="lead rv">Цена за метр зависит не от «ремонта вообще», а от того, что лежит на полу и висит на стенах. Передвиньте ползунок.</p></div><span className="giant" aria-hidden="true">05</span>
        </div>

        <div className="bud-grid">
          <div className="bud-stage">
            <div className="bud-slider">
              <input
                type="range" className="range" min={0} max={2} step={1} value={idx}
                style={{ '--p': `${idx * 50}%` } as React.CSSProperties}
                aria-label="Уровень материалов" aria-valuetext={info.name}
                onChange={(e) => setLevel(LEVELS[Number(e.target.value)])}
              />
              <div className="bud-ticks" role="radiogroup" aria-label="Уровень материалов">
                {catalog.budgetLevels.map((l, i) => (
                  <button key={l.id} role="radio" aria-checked={i === idx} className={i === idx ? 'on' : ''} onClick={() => setLevel(l.id)}>
                    <span>{l.name}</span>
                    <span className="mono num">{cmp ? `${num(cmp[l.id].perM2)} ₽/м²` : '—'}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bud-room"><IsoRoom level={level} /></div>
          </div>

          <aside className="bud-side" aria-live="polite">
            <span className="mono bud-k">{info.name} · {info.tagline}</span>
            <span className="bud-pm display num">{cur ? <Rolling value={cur.perM2} format={(n) => `${num(n)} ₽`} /> : '—'}<small>за м²</small></span>
            <p className="small muted">Для вашей квартиры {String(params.area).replace('.', ',')} м²: <b className="num bud-total">{cur ? rub(cur.total) : '—'}</b></p>
            <ul className="bud-inc">
              {ROWS.map((r) => <li key={r.key}><span className="mono">{r.label}</span><span>{info.includes[r.key]}</span></li>)}
            </ul>
            <button
              className={`btn ${params.level === level ? 'btn-quiet' : 'btn-primary'} btn-block`}
              onClick={() => { set({ level }); scrollToId('calc'); }}
            >
              {params.level === level ? <><Icon name="check" size={18} /> Этот уровень уже в расчёте</> : <>Выбрать «{info.name}» для расчёта</>}
            </button>
          </aside>
        </div>

        <div className="bud-table-wrap">
          <table className="bud-table">
            <caption className="vh">Что входит в каждый уровень и сколько стоит</caption>
            <thead>
              <tr><th scope="col" />{catalog.budgetLevels.map((l, i) => <th key={l.id} scope="col" className={i === idx ? 'on' : ''}>{l.name}</th>)}</tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key}><th scope="row">{r.label}</th>{catalog.budgetLevels.map((l, i) => <td key={l.id} className={i === idx ? 'on' : ''}>{l.includes[r.key]}</td>)}</tr>
              ))}
              <tr className="bud-price"><th scope="row">За м²</th>{LEVELS.map((l, i) => <td key={l} className={`num ${i === idx ? 'on' : ''}`}>{cmp ? rub(cmp[l].perM2) : '—'}</td>)}</tr>
              <tr className="bud-price"><th scope="row">Ваша квартира</th>{LEVELS.map((l, i) => <td key={l} className={`num ${i === idx ? 'on' : ''}`}>{cmp ? rub(cmp[l].total) : '—'}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
