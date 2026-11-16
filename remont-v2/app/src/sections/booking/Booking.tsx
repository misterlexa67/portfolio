import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, checkFields, describeParams, type BookingConfirmation, type DaySlots } from '../../api';
import { Icon } from '../../components/Icon';
import { PhoneInput, Spinner, useToast } from '../../components/ui';
import { humanError, useApi, useIdempotencyKey } from '../../lib/hooks';
import { dateLong, dateShort, dayWord, weekdayShort, rub, plural, parseDate } from '../../lib/format';
import { downloadIcs } from '../../lib/ics';
import { useCalc } from '../../state/calc';
import { MessengerButtons } from '../chrome/Chrome';
import { useTexts } from '../shared';
import './booking.css';

type Field = 'name' | 'phone' | 'consent';
type SlotErr = { text: string; nearest?: { date: string; time: string } | null } | null;

/** Выбор дня и времени — общий для записи и переноса. */
function SlotPicker({ days, date, time, onDate, onTime, exclude }: {
  days: DaySlots[] | undefined; date: string | null; time: string | null;
  onDate: (d: string) => void; onTime: (t: string) => void; exclude?: { date: string; time: string };
}) {
  const day = days?.find((d) => d.date === date);
  return (
    <>
      <fieldset className="bk-fs">
        <legend className="cf-k">1. День <span className="bk-swipe">листайте →</span></legend>
        <div className="bk-days strip-mask" role="radiogroup" aria-label="День замера">
          {!days && Array.from({ length: 7 }, (_, i) => <span key={i} className="bk-day sk" />)}
          {days?.map((d) => {
            const free = d.slots.filter((s) => s.state === 'available').length;
            return (
              <button
                type="button" key={d.date} role="radio" aria-checked={date === d.date}
                className={`bk-day${date === d.date ? ' on' : ''}`} disabled={!free}
                onClick={() => onDate(d.date)}
                aria-label={`${dateLong(d.date)}: ${free ? `свободно ${free}` : d.workday ? 'всё занято' : 'замеров нет'}`}
              >
                <span className="mono">{weekdayShort(d.date)}</span>
                <b className="num">{dateShort(d.date)}</b>
                <span className="bk-free">{free ? `${free} ${plural(free, 'окно', 'окна', 'окон')}` : d.workday ? 'занято' : 'нет окон'}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="bk-fs">
        <legend className="cf-k">2. Время {day && <span className="bk-dayname">— {dateLong(day.date)}</span>}</legend>
        <div className="bk-times" role="radiogroup" aria-label="Время замера" key={date ?? 'none'}>
          {day?.slots.map((s, i) => {
            const mine = exclude && exclude.date === day.date && exclude.time === s.time;
            const off = s.state !== 'available' && !mine;
            return (
              <button
                type="button" key={s.time} role="radio" aria-checked={time === s.time}
                className={`chip bk-time st-${mine ? 'mine' : s.state}`} disabled={off}
                style={{ '--i': i } as React.CSSProperties}
                onClick={() => onTime(s.time)}
                aria-label={`${s.time}${s.state === 'booked' && !mine ? ', занято' : s.state === 'closed' ? ', недоступно' : mine ? ', ваше текущее время' : ''}`}
              >
                <span className="num">{s.time}</span>
                {s.state === 'booked' && !mine && <span className="bk-st">занято</span>}
                {s.state === 'closed' && <span className="bk-st">нет</span>}
                {mine && <span className="bk-st">сейчас</span>}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}

export function Booking() {
  const { params, estimate, touched, origin } = useCalc();
  const texts = useTexts();
  const toast = useToast();
  const { data: days, reload } = useApi(() => api.slots.getCalendar(), [], ['bookings', 'exceptions', 'schedule']);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Partial<Record<Field, string>>>({});
  const [slotErr, setSlotErr] = useState<SlotErr>(null);
  const [done, setDone] = useState<BookingConfirmation | null>(null);
  const [mode, setMode] = useState<'view' | 'move' | 'cancel' | 'cancelled'>('view');
  const [key, newKey] = useIdempotencyKey();

  useEffect(() => {
    if (!days || date) return;
    const first = days.find((d) => d.slots.some((s) => s.state === 'available'));
    if (first) setDate(first.date);
  }, [days, date]);

  const day = useMemo(() => days?.find((d) => d.date === date), [days, date]);
  // выбранное время заняли в соседней вкладке или закрыли в админке — говорим сразу и предлагаем ближайшее
  useEffect(() => {
    if (!day || !time || busy || done) return;
    const s = day.slots.find((x) => x.time === time);
    if (s && s.state !== 'available') {
      setTime(null);
      let nearest: { date: string; time: string } | null = null;
      for (const d of days ?? []) { const f = d.slots.find((x) => x.state === 'available'); if (f) { nearest = { date: d.date, time: f.time }; break; } }
      setSlotErr({ text: s.state === 'booked' ? 'Это время только что заняли. Мы подобрали ближайшее свободное.' : 'Это время закрыли для записи. Мы подобрали ближайшее свободное.', nearest });
    }
  }, [day, time, days, busy, done]);

  // подсказка под полем — после того как человек ушёл из поля, и снимается, как только ошибка исправлена
  const blur = (f: Field) => setErrs((e) => ({ ...e, [f]: checkFields({ [f]: f === 'name' ? name : f === 'phone' ? phone : consent })[f] }));
  const live = (f: Field, v: string | boolean) => { if (errs[f]) setErrs((e) => ({ ...e, [f]: checkFields({ [f]: v })[f] })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const fe = checkFields({ name, phone, consent });
    setErrs(fe);
    if (!date || !time) { setSlotErr({ text: 'Выберите день и время замера' }); return; }
    if (Object.keys(fe).length) return;
    setBusy(true); setSlotErr(null);
    try {
      const res = await api.slots.book({
        date, time, name, phone, consent, idempotencyKey: key,
        params: attach && touched ? params : undefined,
        source: attach && touched ? origin : 'booking',
      });
      setDone(res); setMode('view');
      newKey();
    } catch (ex) {
      const field = ex instanceof ApiError ? ex.field : undefined;
      if (field === 'slot') {
        setSlotErr({ text: humanError(ex), nearest: (ex as ApiError).extra?.nearest as { date: string; time: string } | null });
        setTime(null); newKey(); reload();
      } else if (field === 'name' || field === 'phone' || field === 'consent') setErrs({ [field]: humanError(ex) });
      else setSlotErr({ text: humanError(ex) });
    } finally { setBusy(false); }
  };

  /* ---------- экран успеха ---------- */
  if (done) {
    const s = done.booking;
    return (
      <section className="sheet booking" id="zamer" aria-labelledby="zamer-title">
        <div className="wrap" id="zamer-form">
          <div className="sheet-label"><b>Л-09</b><span>Запись на замер</span><i /></div>
          {mode === 'cancelled' ? (
            <div className="bk-done" role="status">
              <h2 id="zamer-title" className="display h2">Замер <em>отменён</em></h2>
              <p className="lead">Слот освободился — его уже видят другие. Если передумаете, запишитесь снова в удобное время.</p>
              <p className="bk-demo"><Icon name="info" size={18} /> Демо: ничего не отправлено. В панели владельца заявка помечена «Отказ» с заметкой.</p>
              <button className="btn btn-primary" onClick={() => { setDone(null); setMode('view'); setTime(null); setDate(null); }}>Записаться снова</button>
            </div>
          ) : (
            <div className="bk-done" role="status">
              <div className="bk-done-main">
              <span className="bk-check"><Icon name="check" size={34} /></span>
              <span className="bk-done-k">Заявка №{done.lead.number} · {done.lead.name.split(' ').slice(-1)[0]}</span>
              <h2 id="zamer-title" className="bk-when display">
                <span className="bk-when-d">{parseDate(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
                <span className="bk-when-t num">{s.time}</span>
              </h2>
              <p className="lead">{dayWord(s.date).charAt(0).toUpperCase() + dayWord(s.date).slice(1)}, {parseDate(s.date).toLocaleDateString('ru-RU', { weekday: 'long' })}. Инженер приедет к {s.time} и позвонит за час.</p>
              <p className="bk-demo"><Icon name="info" size={18} /> Демо: заявка не отправлена. Она появилась в панели владельца, а слот стал недоступен.</p>

              {mode === 'view' && (
                <div className="bk-done-act">
                  <button className="btn btn-primary" onClick={() => downloadIcs({ date: s.date, time: s.time, title: 'Замер квартиры — Метр', description: `Бесплатный замер. Заявка №${done.lead.number}. Подготовьте план БТИ и пожелания по комнатам. Демо-концепт.`, location: 'Нижний Новгород' })}>
                    <Icon name="calendar" size={18} /> Добавить в календарь
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setMode('move'); setDate(s.date); setTime(null); setSlotErr(null); }}>Перенести</button>
                  <button className="btn btn-quiet" onClick={() => setMode('cancel')}>Отменить</button>
                </div>
              )}

              {mode === 'move' && (
                <div className="bk-move">
                  <h3 className="display">Выберите новое время</h3>
                  <SlotPicker days={days} date={date} time={time} exclude={{ date: s.date, time: s.time }} onDate={(d) => { setDate(d); setTime(null); setSlotErr(null); }} onTime={(t) => { setTime(t); setSlotErr(null); }} />
                  {slotErr && <div className="bk-slot-err" role="alert"><p>{slotErr.text}</p></div>}
                  <div className="bk-done-act">
                    <button className="btn btn-primary" disabled={!date || !time || busy || (date === s.date && time === s.time)} onClick={async () => {
                      if (!date || !time) return;
                      setBusy(true);
                      try { const r = await api.slots.reschedule(done.lead.id, date, time); setDone(r); setMode('view'); toast(`Замер перенесён на ${dayWord(date)}, ${time}`, 'ok'); }
                      catch (ex) { setSlotErr({ text: humanError(ex) }); reload(); }
                      finally { setBusy(false); }
                    }}>{busy ? <Spinner /> : null} Перенести на {date && time ? `${dayWord(date)}, ${time}` : '…'}</button>
                    <button className="btn btn-quiet" onClick={() => setMode('view')}>Оставить как было</button>
                  </div>
                </div>
              )}

              {mode === 'cancel' && (
                <div className="bk-cancel">
                  <p>Отменить замер {dayWord(s.date)} в {s.time}? Слот освободится для других.</p>
                  <div className="bk-done-act">
                    <button className="btn btn-primary" disabled={busy} onClick={async () => {
                      setBusy(true);
                      try { await api.slots.clientCancel(done.lead.id); setMode('cancelled'); } catch (ex) { toast(humanError(ex), 'warn'); } finally { setBusy(false); }
                    }}>{busy ? <Spinner /> : null} Да, отменить</button>
                    <button className="btn btn-quiet" onClick={() => setMode('view')}>Нет, оставить</button>
                  </div>
                </div>
              )}

              </div>
              <div className="bk-what">
                <h3 className="display">Что подготовить к замеру</h3>
                <ol>
                  <li><b>План БТИ или выписку, если есть.</b> Нет — не страшно: инженер обмерит квартиру сам.</li>
                  <li><b>Пожелания по комнатам.</b> Что поменять, что оставить, где нужны розетки и свет.</li>
                  <li><b>Пару картинок интерьеров,</b> которые нравятся — так проще выбрать материалы.</li>
                  <li><b>Доступ к щитку и стоякам,</b> пропуск или код домофона, место для парковки.</li>
                </ol>
                <p className="small muted">Замер занимает 45–60 минут, бесплатный и ни к чему не обязывает. Через 2 дня пришлём точную смету.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ---------- форма ---------- */
  return (
    <section className="sheet booking" id="zamer" aria-labelledby="zamer-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-09</b><span>Запись на замер</span><i /><span>бесплатно</span></div>
        <div className="bk-grid" id="zamer-form">
          <div className="bk-intro">
            <h2 id="zamer-title" className="display h2 rv">Запишитесь <em>на замер</em></h2>
            <p className="lead rv">Свободные окна — настоящие: занятое время сразу пропадает. Инженер приедет в выбранный час.</p>
            {touched && estimate && (
              <div className="bk-calc">
                <span className="mono bk-calc-k">Ваш расчёт</span>
                <span>{describeParams(params)}</span>
                <b className="num">от {rub(estimate.total)}</b>
                <label className="check">
                  <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
                  <span>Приложить расчёт к заявке — инженер подготовится заранее</span>
                </label>
              </div>
            )}
            <div className="bk-contacts">
              <span className="small muted">Не хотите ждать — напишите:</span>
              <MessengerButtons />
              {texts && <span className="small muted">или позвоните {texts.contacts.phone} · {texts.contacts.hours}</span>}
            </div>
          </div>

          <form className="bk-form" onSubmit={submit} noValidate>
            <SlotPicker days={days} date={date} time={time} onDate={(d) => { setDate(d); setTime(null); setSlotErr(null); }} onTime={(t) => { setTime(t); setSlotErr(null); }} />
            {slotErr && (
              <div className="bk-slot-err" role="alert">
                <p>{slotErr.text}</p>
                {slotErr.nearest && <button type="button" className="btn btn-s btn-primary" onClick={() => { setDate(slotErr.nearest!.date); setTime(slotErr.nearest!.time); setSlotErr(null); }}>Записаться на {dayWord(slotErr.nearest.date)}, {slotErr.nearest.time}</button>}
              </div>
            )}

            <fieldset className="bk-fs bk-contact">
              <legend className="cf-k">3. Контакты</legend>
              <label className="field"><span>Имя</span>
                <input className="input" value={name} onChange={(e) => { setName(e.target.value); live('name', e.target.value); }} onBlur={() => name && blur('name')} autoComplete="given-name" aria-invalid={!!errs.name || undefined} aria-describedby={errs.name ? 'e-name' : undefined} enterKeyHint="next" />
                {errs.name && <span className="field-hint" id="e-name" role="alert">{errs.name}</span>}
              </label>
              <label className="field"><span>Телефон</span>
                <PhoneInput value={phone} onChange={(v) => { setPhone(v); live('phone', v); }} invalid={!!errs.phone} describedBy={errs.phone ? 'e-phone' : undefined} />
                {errs.phone && <span className="field-hint" id="e-phone" role="alert">{errs.phone}</span>}
              </label>
              <div onBlur={() => { if (errs.consent) blur('consent'); }}>
                <label className="check" data-invalid={!!errs.consent || undefined}>
                  <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); live('consent', e.target.checked); }} />
                  <span>Согласен на обработку персональных данных по <a className="link" href="./privacy/" target="_blank" rel="noopener">политике конфиденциальности</a></span>
                </label>
                {errs.consent && <span className="field-hint" role="alert">{errs.consent}</span>}
              </div>
            </fieldset>

            <button className="btn btn-primary btn-block bk-submit" disabled={busy}>
              {busy ? <><Spinner /> Записываем…</> : <>Записаться на замер{date && time ? ` — ${dayWord(date)}, ${time}` : ''}</>}
            </button>
            <p className="micro muted">Демо: заявка не отправляется. Она появится в панели владельца, а выбранный слот станет занятым.</p>
          </form>
        </div>
      </div>
    </section>
  );
}
