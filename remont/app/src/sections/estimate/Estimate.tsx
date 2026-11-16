import { useState } from 'react';
import { api, catalog, describeParams, type Lead } from '../../api';
import { Icon } from '../../components/Icon';
import { Modal, PhoneInput, Popover, Spinner, useToast } from '../../components/ui';
import { humanError } from '../../lib/hooks';
import { rub, weeks, num } from '../../lib/format';
import { shareEstimate } from '../../lib/share';
import { downloadEstimatePdf, estimateNumber } from '../../pdf/estimatePdf';
import { scrollToId, useCalc } from '../../state/calc';
import { useTexts } from '../shared';
import './estimate.css';

export function EstimateSection() {
  const { estimate: e, plan, estimateOpen, openEstimate, shared, dismissShared, origin, params } = useCalc();
  const texts = useTexts();
  const toast = useToast();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tgOpen, setTgOpen] = useState(false);

  const pdf = async () => {
    if (!e) return;
    setPdfBusy(true);
    try {
      await downloadEstimatePdf(e, plan, texts);
      toast('Смета скачана в PDF', 'ok');
    } catch {
      toast('Не получилось сформировать PDF — проверьте интернет и попробуйте ещё раз', 'warn');
    } finally { setPdfBusy(false); }
  };

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
          <p className="lead rv">Каждая строка — с суммой и долей. Нажмите «что входит», чтобы увидеть работы внутри. Эта же смета уходит в PDF и в договор.</p>
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

            <table className="sd-table">
              <caption className="vh">Смета по этапам: сумма и доля каждой строки</caption>
              <thead>
                <tr><th scope="col">Этап</th><th scope="col" className="sd-share-h">Доля</th><th scope="col" className="r">Сумма</th></tr>
              </thead>
              <tbody>
                {e.lines.map((l) => (
                  <tr key={l.id}>
                    <th scope="row">
                      <span className="sd-title">{l.title}</span>
                      <Popover label={<>что входит <Icon name="info" size={14} /></>}>
                        <b>{l.title} — {rub(l.amount)}</b>
                        <ul>{l.includes.map((x) => <li key={x}>{x}</li>)}</ul>
                      </Popover>
                    </th>
                    <td className="sd-share">
                      <span className="bar" aria-hidden="true"><span className={l.kind === 'materials' ? 'mat' : ''} style={{ transform: `scaleX(${Math.max(0.02, l.share)})` }} /></span>
                      <span className="num mono">{Math.round(l.share * 100)}%</span>
                    </td>
                    <td className="r num sd-amt">{rub(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="sd-sub"><th scope="row">Работы</th><td /><td className="r num">{rub(e.worksTotal)}</td></tr>
                <tr className="sd-sub"><th scope="row">Материалы <span className="muted small">— по ценам поставщиков, без наценки</span></th><td /><td className="r num">{rub(e.materialsTotal)}</td></tr>
                <tr className="sd-total">
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

            <div className="sd-pay">
              <h3 className="sd-h3">Оплата по этапам — не всё сразу</h3>
              <ol className="pay-scale">
                {e.payments.map((p, i) => (
                  <li key={p.id} style={{ flexGrow: p.percent }}>
                    <span className={`pay-bar${i === 0 ? ' first' : ''}`} aria-hidden="true" />
                    <span className="pay-pct display">{p.percent}%</span>
                    <span className="num pay-amt">{rub(p.amount)}</span>
                    <span className="small muted">{p.after}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="sd-promise">
              <Icon name="lock" size={22} />
              <p><b className="display">{texts?.fixedPromise ?? 'Смета фиксируется в договоре. Цена не изменится'}.</b>
                <span className="small muted">Это расчёт «от» по типовой планировке. После бесплатного замера инженер пришлёт точную смету — она и пойдёт в договор.</span></p>
            </div>

            <div className="sd-actions">
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
          <p className="small muted">Пришлём смету и PDF в Telegram на ваш номер. <b>Демо: ничего не отправляется</b> — вы увидите сообщение, а заявка появится в панели владельца.</p>
          <label className="field"><span>Как к вам обращаться</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" aria-invalid={err?.field === 'name' || undefined} data-autofocus />
          </label>
          <label className="field"><span>Телефон в Telegram</span>
            <PhoneInput value={phone} onChange={setPhone} invalid={err?.field === 'phone'} />
          </label>
          <label className="check" data-invalid={err?.field === 'consent' || undefined}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Согласен на обработку персональных данных по <a className="link" href="./privacy/" target="_blank" rel="noopener">политике конфиденциальности</a></span>
          </label>
          {err && <p className="err" role="alert">{err.text}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : <Icon name="send" size={18} />} Прислать смету</button>
        </form>
      ) : (
        <div className="tg-preview">
          <div className="tg-bubble">
            <span className="tg-from mono">Метр · бот</span>
            <pre>{estimate ? api.estimates.telegramMessage(estimate) : ''}</pre>
            <span className="tg-file"><Icon name="doc" size={18} /> Смета.pdf</span>
          </div>
          <p className="tg-demo"><Icon name="info" size={16} /> Демо: сообщение не отправлено. Заявка №{lead.number} создана в панели владельца.</p>
          <button className="btn btn-quiet btn-block" onClick={close}>Понятно</button>
        </div>
      )}
    </Modal>
  );
}
