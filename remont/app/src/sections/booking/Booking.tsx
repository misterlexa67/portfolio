import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, describeParams, type BookingConfirmation } from '../../api';
import { Icon } from '../../components/Icon';
import { PhoneInput, Spinner } from '../../components/ui';
import { humanError, useApi, useIdempotencyKey } from '../../lib/hooks';
import { dateLong, dateShort, dayWord, weekdayShort, rub, plural } from '../../lib/format';
import { downloadIcs } from '../../lib/ics';
import { useCalc } from '../../state/calc';
import { MessengerButtons } from '../chrome/Chrome';
import { useTexts } from '../shared';
import './booking.css';

type Err = { field?: string; text: string; nearest?: { date: string; time: string } | null };

export function Booking() {
  const { params, estimate, touched, origin } = useCalc();
  const texts = useTexts();
  const { data: days, reload } = useApi(() => api.slots.getCalendar(), [], ['bookings', 'exceptions', 'schedule']);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Err | null>(null);
  const [done, setDone] = useState<BookingConfirmation | null>(null);
  const [key, newKey] = useIdempotencyKey();
  const formRef = useRef<HTMLDivElement>(null);

  // по умолчанию — первый день со свободным временем
  useEffect(() => {
    if (!days || date) return;
    const first = days.find((d) => d.slots.some((s) => s.state === 'available'));
    if (first) setDate(first.date);
  }, [days, date]);

  const day = useMemo(() => days?.find((d) => d.date === date), [days, date]);
  // выбранное время стало недоступно (заняли в соседней вкладке или закрыли в админке)
  useEffect(() => {
    if (!day || !time || busy) return;
    const s = day.slots.find((x) => x.time === time);
    if (s && s.state !== 'available') {
      setTime(null);
      let nearest: Err['nearest'] = null;
      for (const d of days ?? []) { const f = d.slots.find((x) => x.state === 'available'); if (f) { nearest = { date: d.date, time: f.time }; break; } }
      setErr({ field: 'slot', text: s.state === 'booked' ? 'Это время только что заняли. Мы подобрали ближайшее свободное.' : 'Это время закрыли для записи. Мы подобрали ближайшее свободное.', nearest });
    }
  }, [day, time, days, busy]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!date || !time) { setErr({ field: 'slot', text: 'Выберите день и время замера' }); return; }
    setBusy(true); setErr(null);
    try {
      const res = await api.slots.book({
        date, time, name, phone, consent, idempotencyKey: key,
        params: attach && touched ? params : undefined,
        source: attach && touched ? origin : 'booking',
      });
      setDone(res);
      newKey();
    } catch (ex) {
      const field = ex instanceof ApiError ? ex.field : undefined;
      const nearest = ex instanceof ApiError ? (ex.extra?.nearest as Err['nearest']) : undefined;
      setErr({ field, text: humanError(ex), nearest });
      if (field === 'slot') { setTime(null); newKey(); reload(); }
    } finally { setBusy(false); }
  };

  const pickNearest = (n: { date: string; time: string }) => { setDate(n.date); setTime(n.time); setErr(null); };

  if (done) {
    const s = done.booking;
    return (
      <section className="sheet booking" id="zamer" aria-labelledby="zamer-title">
        <div className="wrap" id="zamer-form">
          <div className="sheet-label"><b>Л-09</b><span>Запись на замер</span><i /></div>
          <div className="bk-done" role="status">
            <span className="bk-check"><Icon name="check" size={34} /></span>
            <h2 id="zamer-title" className="display h2">Записали на <em>{dayWord(s.date)}, {s.time}</em></h2>
            <p className="lead">{done.lead.name}, инженер приедет {dateLong(s.date)} в {s.time}. Заявка №{done.lead.number}.</p>
            <p className="bk-demo"><Icon name="info" size={18} /> Демо: заявка не отправлена. Она появилась в панели владельца, а слот стал недоступен.</p>
            <div className="bk-done-act">
              <button className="btn btn-primary" onClick={() => downloadIcs({ date: s.date, time: s.time, title: 'Замер квартиры — Метр', description: `Бесплатный замер. Заявка №${done.lead.number}. Демо-концепт.`, location: 'Нижний Новгород' })}>
                <Icon name="calendar" size={18} /> Добавить в календарь
              </button>
              <button className="btn btn-quiet" onClick={() => { setDone(null); setTime(null); setDate(null); }}>Записать ещё одну квартиру</button>
            </div>
            <div className="bk-what">
              <h3 className="display">Что будет на замере</h3>
              <ol>
                <li><b>45–60 минут.</b> Инженер обмерит квартиру лазерным дальномером и сделает обмерный план.</li>
                <li><b>Проверим основание:</b> перепады пола, кривизну стен, состояние проводки и труб.</li>
                <li><b>Обсудим задачу:</b> что хотите поменять, какие материалы нравятся, нужна ли перепланировка.</li>
                <li><b>Через 2 дня</b> пришлём точную смету по этапам. Она и пойдёт в договор.</li>
              </ol>
              <p className="small muted">Замер бесплатный и ни к чему не обязывает.</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="sheet booking" id="zamer" aria-labelledby="zamer-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-09</b><span>Запись на замер</span><i /><span>бесплатно</span></div>
        <div className="bk-grid" id="zamer-form" ref={formRef}>
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
                      onClick={() => { setDate(d.date); setTime(null); setErr(null); }}
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
              <div className="bk-times" role="radiogroup" aria-label="Время замера">
                {day?.slots.map((s) => (
                  <button
                    type="button" key={s.time} role="radio" aria-checked={time === s.time}
                    className={`chip bk-time${s.state !== 'available' ? ' off' : ''}`} disabled={s.state !== 'available'}
                    onClick={() => { setTime(s.time); setErr(null); }}
                  >
                    <span className="num">{s.time}</span>
                    {s.state === 'booked' && <span className="bk-st">занято</span>}
                    {s.state === 'closed' && <span className="bk-st">нет</span>}
                  </button>
                ))}
              </div>
              {err?.field === 'slot' && (
                <div className="bk-slot-err" role="alert">
                  <p>{err.text}</p>
                  {err.nearest && <button type="button" className="btn btn-s btn-primary" onClick={() => pickNearest(err.nearest!)}>Записаться на {dayWord(err.nearest.date)}, {err.nearest.time}</button>}
                </div>
              )}
            </fieldset>

            <fieldset className="bk-fs bk-contact">
              <legend className="cf-k">3. Контакты</legend>
              <label className="field"><span>Имя</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" aria-invalid={err?.field === 'name' || undefined} enterKeyHint="next" />
              </label>
              <label className="field"><span>Телефон</span>
                <PhoneInput value={phone} onChange={setPhone} invalid={err?.field === 'phone'} />
              </label>
              <label className="check" data-invalid={err?.field === 'consent' || undefined}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>Согласен на обработку персональных данных по <a className="link" href="./privacy/" target="_blank" rel="noopener">политике конфиденциальности</a></span>
              </label>
            </fieldset>

            {err && err.field !== 'slot' && <p className="err bk-err" role="alert">{err.text}</p>}
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
