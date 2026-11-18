import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, catalog, describeParams, type CostLayer, type IsoLayers, type Lead } from '../../api';
import { Icon } from '../../components/Icon';
import { IsoApartment } from '../../components/iso/IsoApartment';
import type { LayerKey } from '../../components/iso/engine';
import { Modal, PhoneInput, Popover, Spinner, useToast } from '../../components/ui';
import { humanError } from '../../lib/hooks';
import { rub, weeks, num, isoDate, parseDate } from '../../lib/format';
import { reduced } from '../../lib/motion';
import { shareEstimate } from '../../lib/share';
import { downloadEstimatePdf, estimateNumber } from '../../pdf/estimatePdf';
import { scrollToId, useCalc } from '../../state/calc';
import { useTexts } from '../shared';
import './estimate.css';

const fmtQty = (q: number) => q.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const ISO_LAYERS: Partial<Record<CostLayer, LayerKey>> = {
  screed: 'screed', partitions: 'partitions', electrics: 'electrics', warmFloor: 'warmFloor',
  walls: 'walls', floor: 'floor', light: 'light', conditioner: 'conditioner', plumbing: 'walls',
};
const addDays = (d: string, n: number) => { const x = parseDate(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const LAYER_NAMES: Partial<Record<CostLayer, string>> = {
  demolition: 'демонтаж', screed: 'стяжка', partitions: 'стены и перегородки', electrics: 'электрика', warmFloor: 'тёплый пол',
  plumbing: 'трубы', walls: 'отделка стен', floor: 'пол', light: 'свет', conditioner: 'кондиционеры',
};
const readyNames = (ls: CostLayer[]) => ls.map((l) => LAYER_NAMES[l]).filter(Boolean).join(', ');

/** Выбор даты начала — чип и свой календарь на 6 недель вперёд (ячейки 44px). */
function StartPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const first = new Date(today); first.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // понедельник
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return d; });
  return (
    <div className="start-pick" ref={box}>
      <button type="button" className="chip start-chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="calendar" size={16} /> Старт: {fmtDay(parseDate(value))} <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="start-cal" role="dialog" aria-label="Дата начала ремонта">
          <div className="start-wd mono">{['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((w) => <span key={w}>{w}</span>)}</div>
          <div className="start-grid">
            {cells.map((d) => {
              const iso = isoDate(d); const past = d < today;
              return (
                <button key={iso} type="button" disabled={past} aria-pressed={iso === value} className={iso === value ? 'on' : ''}
                  onClick={() => { onChange(iso); setOpen(false); }} aria-label={d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}>
                  <span className="num">{d.getDate()}</span>
                  {d.getDate() === 1 && <small>{d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** FLIP: строки, которые сдвигаются при раскрытии, доезжают плавно — только transform. */
function useFlip(container: React.RefObject<HTMLElement>, dep: unknown) {
  const before = useRef<Map<Element, number>>(new Map());
  const snapshot = () => {
    const m = new Map<Element, number>();
    container.current?.querySelectorAll('[data-flip]').forEach((el) => m.set(el, el.getBoundingClientRect().top));
    before.current = m;
  };
  useLayoutEffect(() => {
    if (reduced()) return;
    container.current?.querySelectorAll('[data-flip]').forEach((el) => {
      const was = before.current.get(el);
      if (was === undefined) return;
      const dy = was - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      (el as HTMLElement).animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    });
    before.current = new Map();
  }, [dep]); // eslint-disable-line react-hooks/exhaustive-deps
  return snapshot;
}

export function EstimateSection() {
  const { estimate: e, plan, estimateOpen, openEstimate, shared, dismissShared, origin, params } = useCalc();
  const texts = useTexts();
  const toast = useToast();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tgOpen, setTgOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [start, setStart] = useState(() => isoDate(new Date(Date.now() + 14 * 86400000)));
  const [payIdx, setPayIdx] = useState(1);
  const tableRef = useRef<HTMLTableElement>(null);
  const snapshot = useFlip(tableRef, open);

  const toggle = (id: string) => { snapshot(); setOpen(open === id ? null : id); };
  // тап на этап шкалы в «Как мы работаем» — выбираем этот платёж
  useEffect(() => {
    const on = (ev: Event) => setPayIdx(Number((ev as CustomEvent<number>).detail) || 0);
    window.addEventListener('metr:payment', on);
    return () => window.removeEventListener('metr:payment', on);
  }, []);

  const pdf = async () => {
    if (!e) return;
    setPdfBusy(true);
    try {
      await downloadEstimatePdf(e, plan, texts, { start });
      toast('Смета скачана в PDF', 'ok');
    } catch {
      toast('Не получилось сформировать PDF — проверьте интернет и попробуйте ещё раз', 'warn');
    } finally { setPdfBusy(false); }
  };

  // мини-изометрия к платежу: готово всё, что было до него включительно; подсвечиваем его слои
  const payView = useMemo(() => {
    if (!e) return null;
    const upto = e.payments.slice(0, payIdx + 1).flatMap((p) => p.layers);
    const has = (k: CostLayer) => upto.includes(k);
    const l: IsoLayers = {
      screed: e.layers.screed && has('screed'), partitions: true, electrics: e.layers.electrics && has('electrics'),
      warmFloor: e.layers.warmFloor && has('warmFloor'), walls: has('walls'), floor: has('floor'), light: has('light'),
      furniture: payIdx >= e.payments.length - 1, conditioner: e.layers.conditioner && has('conditioner'),
    };
    const focus = [...new Set(e.payments[payIdx].layers.map((k) => ISO_LAYERS[k]).filter(Boolean))] as LayerKey[];
    return { layers: l, focus };
  }, [e, payIdx]);

  const priceChanged = shared?.total && e && shared.total !== e.total;

  return (
    <section className="sheet smeta" id="smeta" aria-labelledby="smeta-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-04</b><span>Смета по этапам</span><i /><span>шаг 3 из 3</span></div>

        {shared && (
          <div className="shared-note" role="status">
            <Icon name="share" size={18} />
            <span>
              Вы открыли смету по ссылке — те же параметры и та же квартира.
              {priceChanged && <> Цены с тех пор обновились: по ссылке было {rub(shared.total!)}, сейчас {rub(e!.total)}.</>}
            </span>
            <button className="modal-close" aria-label="Скрыть" onClick={dismissShared}><Icon name="close" size={16} /></button>
          </div>
        )}

        <div className="smeta-head">
          <h2 id="smeta-title" className="display h2 rv">За что вы <em>платите</em></h2>
          <p className="lead rv">Каждая строка раскрывается списком работ с объёмами — посчитано из площади и комнат вашей квартиры. Эта же смета уходит в PDF и в договор.</p>
        </div>

        {!estimateOpen ? (
          <button className="smeta-teaser" onClick={() => openEstimate(true)} disabled={!e}>
            <span className="st-lines" aria-hidden="true">
              {e?.lines.map((l) => <span key={l.id} style={{ flexGrow: l.share }} className={l.kind === 'materials' ? 'mat' : ''} />)}
            </span>
            <span className="st-txt">
              <b>Открыть смету по этапам</b>
              <span className="small muted">{e ? `${e.lines.length} строк · ${e.payments.length} платежа · от ${rub(e.total)}` : 'Считаем…'}</span>
            </span>
            <Icon name="arrowDown" />
          </button>
        ) : e && (
          <div className="smeta-doc rv in">
            <header className="sd-top">
              <div>
                <span className="mono sd-no">Смета {estimateNumber(e)} · {new Date(e.createdAt).toLocaleDateString('ru-RU')}</span>
                <p className="sd-params">{describeParams(params)}</p>
                {params.options.length > 0 && <p className="small muted">Дополнительно: {params.options.map((o) => catalog.options.find((x) => x.id === o)!.name.toLowerCase()).join(', ')}</p>}
              </div>
              <button className="link small" onClick={() => scrollToId('calc')}>Изменить параметры</button>
            </header>

            <table className="sd-table" ref={tableRef}>
              <caption className="vh">Смета по этапам: сумма и доля каждой строки, раскрывается списком работ с объёмами</caption>
              <thead>
                <tr><th scope="col">Этап</th><th scope="col" className="sd-share-h">Доля</th><th scope="col" className="r">Сумма</th></tr>
              </thead>
              <tbody>
                {e.lines.map((l) => {
                  const isOpen = open === l.id;
                  return (
                    <Fragment key={l.id}>
                      <tr data-flip className={isOpen ? 'is-open' : ''}>
                        <th scope="row">
                          <span className="sd-title">{l.title}</span>
                          <button className="sd-more" aria-expanded={isOpen} aria-controls={`sd-${l.id}`} onClick={() => toggle(l.id)}>
                            {isOpen ? 'свернуть' : `что входит · ${l.items.length}`} <Icon name="chevronDown" size={14} className={isOpen ? 'rot' : ''} />
                          </button>
                        </th>
                        <td className="sd-share">
                          <span className="bar" aria-hidden="true"><span className={l.kind === 'materials' ? 'mat' : ''} style={{ transform: `scaleX(${Math.max(0.02, l.share)})` }} /></span>
                          <span className="num mono">{Math.round(l.share * 100)}%</span>
                        </td>
                        <td className="r num sd-amt">{rub(l.amount)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="sd-detail" id={`sd-${l.id}`}>
                          <td colSpan={3}>
                            <ul className="sd-items">
                              {l.items.map((it) => (
                                <li key={it.id}>
                                  <span className="sd-it-t">{it.title}</span>
                                  <span className="sd-it-q num mono">{fmtQty(it.qty)} {it.unit}</span>
                                  <span className="sd-it-a num">{rub(it.amount)}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="micro muted">Объёмы — по типовой планировке, после замера уточним до сантиметра.</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="sd-sub" data-flip><th scope="row">Работы</th><td /><td className="r num">{rub(e.worksTotal)}</td></tr>
                <tr className="sd-sub" data-flip><th scope="row">Материалы <span className="muted small">— по ценам поставщиков, без наценки</span></th><td /><td className="r num">{rub(e.materialsTotal)}</td></tr>
                <tr className="sd-total" data-flip>
                  <th scope="row">Итого, от
                    <Popover label={<Icon name="info" size={16} />}>
                      <b>Из чего итог</b>
                      <ul>
                        <li>Работы: {num(e.worksTotal)} ₽ с коэффициентом дома ×{String(e.houseCoef).replace('.', ',')}</li>
                        <li>Материалы: {num(e.materialsTotal)} ₽</li>
                        <li>{num(e.perM2)} ₽ за м², срок {weeks(e.weeks.min, e.weeks.max)}</li>
                      </ul>
                    </Popover>
                  </th>
                  <td className="mono small muted">{num(e.perM2)} ₽/м²</td>
                  <td className="r num">{rub(e.total)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="sd-pay" id="smeta-pay" data-flip>
              <div className="pay-head">
                <h3 className="sd-h3">Оплата по этапам — не всё сразу</h3>
                <StartPicker value={start} onChange={setStart} />
              </div>
              <div className="pay-grid">
                <ol className="pay-steps" role="radiogroup" aria-label="Этап оплаты">
                  {e.payments.map((p, i) => (
                    <li key={p.id}>
                      <button className={`pay-step${i === payIdx ? ' on' : ''}${i === 0 ? ' first' : ''}`} role="radio" aria-checked={i === payIdx} onClick={() => setPayIdx(i)}>
                        <span className="pay-bar" aria-hidden="true" style={{ transform: `scaleX(${p.percent / 100 * 2.4})` }} />
                        <span className="pay-row1"><span className="pay-pct display">{p.percent}%</span><span className="num pay-amt">{rub(p.amount)}</span></span>
                        <span className="pay-when"><Icon name="calendar" size={14} /> ≈ {fmtDay(addDays(start, p.dayOffset))} · {p.after}</span>
                        <span className="pay-ready small">{p.ready}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {payView && (
                  <figure className="pay-iso" aria-label="Что будет готово к выбранному платежу">
                    <IsoApartment plan={plan} layers={payView.layers} level={params.level} type={params.type} focus={payView.focus.length ? payView.focus : null} assembled detail="low" stagger={0} title="Готовность квартиры к платежу" />
                    <figcaption className="pay-iso-cap"><span className="tag tag-sage">готово к платежу</span> {readyNames(e.payments[payIdx].layers)}</figcaption>
                  </figure>
                )}
              </div>
              <p className="micro muted">Даты примерные: считаем от выбранного дня по сроку {weeks(e.weeks.min, e.weeks.max)}. Точный график — в приложении к договору.</p>
            </div>

            <div className="sd-promise" data-flip>
              <Icon name="lock" size={22} />
              <p><b className="display">{texts?.fixedPromise ?? 'Смета фиксируется в договоре. Цена не изменится'}.</b>
                <span className="small muted">Это расчёт «от» по типовой планировке. После бесплатного замера инженер пришлёт точную смету — она и пойдёт в договор.</span></p>
            </div>

            <div className="sd-actions" data-flip>
              <button className="btn btn-primary" onClick={pdf} disabled={pdfBusy}>
                {pdfBusy ? <Spinner /> : <Icon name="download" size={18} />} Скачать смету PDF
              </button>
              <button className="btn btn-ghost" onClick={() => setTgOpen(true)}><Icon name="send" size={18} /> Прислать смету в Telegram</button>
              <button className="btn btn-quiet" onClick={() => shareEstimate(e, toast)}><Icon name="share" size={18} /> Поделиться сметой</button>
            </div>
          </div>
        )}
      </div>
      <TelegramModal open={tgOpen} onClose={() => setTgOpen(false)} source={origin} />
    </section>
  );
}

function TelegramModal({ open, onClose, source }: { open: boolean; onClose: () => void; source: import('../../api').CalcOrigin }) {
  const { params, estimate } = useCalc();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<{ field?: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      setLead(await api.leads.createFromEstimate({ name, phone, consent, params, source }));
    } catch (e) {
      const f = (e as { field?: string }).field;
      setErr({ field: f, text: humanError(e) });
    } finally { setBusy(false); }
  };
  const close = () => { onClose(); window.setTimeout(() => { setLead(null); setErr(null); }, 300); };

  return (
    <Modal open={open} onClose={close} title={lead ? 'Так выглядело бы сообщение' : 'Прислать смету в Telegram'}>
      {!lead ? (
        <form className="tg-form" onSubmit={submit} noValidate>
          <p className="small muted">Пришлём смету и PDF в Telegram на ваш номер. Вы увидите сообщение, а заявка появится в панели владельца.</p>
          <label className="field"><span>Как к вам обращаться</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" aria-invalid={err?.field === 'name' || undefined} data-autofocus />
            {err?.field === 'name' && <span className="field-hint" role="alert">{err.text}</span>}
          </label>
          <label className="field"><span>Телефон в Telegram</span>
            <PhoneInput value={phone} onChange={setPhone} invalid={err?.field === 'phone'} />
            {err?.field === 'phone' && <span className="field-hint" role="alert">{err.text}</span>}
          </label>
          <label className="check" data-invalid={err?.field === 'consent' || undefined}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Согласен на обработку персональных данных по <a className="link" href="./privacy/" target="_blank" rel="noopener">политике конфиденциальности</a></span>
          </label>
          {err?.field === 'consent' && <span className="field-hint" role="alert">{err.text}</span>}
          {err && !['name', 'phone', 'consent'].includes(err.field ?? '') && <p className="field-hint" role="alert">{err.text}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : <Icon name="send" size={18} />} Прислать смету</button>
        </form>
      ) : (
        <div className="tg-preview">
          <div className="tg-bubble">
            <span className="tg-from mono">Метр · бот</span>
            <pre>{estimate ? api.estimates.telegramMessage(estimate) : ''}</pre>
            <span className="tg-file"><Icon name="doc" size={18} /> Смета.pdf</span>
          </div>
          <p className="tg-demo"><Icon name="info" size={16} /> Готово! Так заявка выглядит у владельца. Заявка №{lead.number} создана.</p>
          <button className="btn btn-quiet btn-block" onClick={close}>Понятно</button>
        </div>
      )}
    </Modal>
  );
}
