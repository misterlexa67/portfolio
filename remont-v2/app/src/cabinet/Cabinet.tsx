import { useState } from 'react';
import { api, cabinetSummary, catalog, type CabinetPhoto } from '../api';
import { Icon } from '../components/Icon';
import { Modal, Spinner, useToast } from '../components/ui';
import { useApi } from '../lib/hooks';
import { dateLong, dateShort, dateTime, rub, area, plural, telHref, parseDate } from '../lib/format';
import { Logo } from '../sections/chrome/Chrome';
import { StagePhoto } from './StagePhoto';
import './cabinet.css';

export function CabinetApp() {
  const [session, setSession] = useState(() => api.auth.session().client);
  const [busy, setBusy] = useState(false);
  const login = async () => { setBusy(true); await api.auth.clientLogin(); setBusy(false); setSession(true); };
  const logout = async () => { await api.auth.logout('client'); setSession(false); };

  return (
    <>
      <div className="demobar" role="note"><span className="mono">Демо-концепт, бизнес вымышленный · кабинет с вымышленным клиентом</span></div>
      <header className="cab-hdr">
        <div className="wrap cab-hdr-in">
          <Logo href="../" />
          <span className="mono cab-k">Кабинет клиента</span>
          {session && <button className="btn btn-s btn-ghost" onClick={logout}><Icon name="logout" size={18} /> Выйти</button>}
        </div>
      </header>
      <main>{session ? <Dashboard /> : <Login busy={busy} onLogin={login} />}</main>
    </>
  );
}

function Login({ busy, onLogin }: { busy: boolean; onLogin: () => void }) {
  return (
    <section className="wrap cab-login">
      <div className="cab-login-card">
        <span className="sheet-label"><b>Кабинет</b><span>ремонт онлайн</span><i /></span>
        <h1 className="display">Ваш ремонт — <em>каждый день</em> на экране</h1>
        <p className="lead">Этап, фото от прораба, график и платежи. Больше не нужно звонить и спрашивать «как там ремонт?».</p>
        <button className="btn btn-primary btn-block" onClick={onLogin} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="user" size={18} />} Войти как клиент (демо)
        </button>
        <p className="small muted">Демо-вход без пароля. Вы увидите вымышленный ремонт двушки в брежневке на этапе чистовых работ.</p>
        <a className="link small" href="../">← Вернуться на сайт</a>
      </div>
    </section>
  );
}

function Dashboard() {
  const { data: c } = useApi(() => api.cabinet.get(), [], ['cabinet']);
  const toast = useToast();
  const [photo, setPhoto] = useState<CabinetPhoto | null>(null);
  if (!c) return <div className="wrap cab-loading"><Spinner /> Загружаем ваш ремонт…</div>;
  const s = cabinetSummary(c);
  const daysLeft = Math.max(0, Math.round((parseDate(c.planEnd).getTime() - Date.now()) / 86400000));
  const house = catalog.houseTypes.find((h) => h.id === c.house)!;

  return (
    <div className="wrap cab">
      <section className="cab-hero">
        <div>
          <span className="mono cab-addr">{c.address}</span>
          <h1 className="display cab-h1">{c.clientName}, ремонт идёт <em>по графику</em></h1>
          <p className="muted">{house.name}, {c.rooms}-комн., {area(c.area)} · {catalog.renovationTypes.find((t) => t.id === c.type)!.name.toLowerCase()} ремонт</p>
          <p className="cab-msg"><Icon name="eye" size={18} /> Вы видите ремонт каждый день, не выходя из дома</p>
        </div>
        <div className="cab-progress">
          <div className="cab-ring" style={{ '--p': s.progress } as React.CSSProperties}>
            <span className="display num">{s.progress}%</span>
            <span className="mono">готово</span>
          </div>
          <dl>
            <div><dt>Сейчас</dt><dd>{s.current.title}</dd></div>
            <div><dt>Сдача</dt><dd className="num">{dateLong(c.planEnd)}</dd></div>
            <div><dt>Осталось</dt><dd className="num">{daysLeft} {plural(daysLeft, 'день', 'дня', 'дней')}</dd></div>
          </dl>
        </div>
      </section>

      <section className="cab-current" aria-labelledby="cur-t">
        <div className="cc-head">
          <span className="tag tag-clay">текущий этап</span>
          <h2 id="cur-t" className="display">{s.current.title}</h2>
          <span className="mono small muted">{dateShort(s.current.start)} — {dateShort(s.current.end)}</span>
        </div>
        <div className="cc-bar" role="progressbar" aria-valuenow={s.current.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс этапа">
          <span style={{ transform: `scaleX(${s.current.progress / 100})` }} />
        </div>
        <span className="num cc-pct">{s.current.progress}% этапа</span>
      </section>

      <div className="cab-grid">
        <section className="cab-card" aria-labelledby="sch-t">
          <h3 id="sch-t" className="cab-h3">График</h3>
          <ol className="sch">
            {c.stages.map((st) => (
              <li key={st.id} className={`sch-i ${st.status}`}>
                <span className="sch-dot" aria-hidden="true">{st.status === 'done' && <Icon name="check" size={12} />}</span>
                <div>
                  <b>{st.title}</b>
                  <span className="small muted num">{dateShort(st.start)} — {dateShort(st.end)}{st.status === 'current' ? ` · ${st.progress}%` : ''}</span>
                </div>
                <span className="sch-st mono">{st.status === 'done' ? 'готово' : st.status === 'current' ? 'идёт' : 'дальше'}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="cab-card" aria-labelledby="pay-t">
          <h3 id="pay-t" className="cab-h3">Платежи</h3>
          <div className="pay-sum">
            <span className="display num">{rub(s.paid)}</span>
            <span className="small muted num">оплачено из {rub(c.contractTotal)} · смета зафиксирована в договоре</span>
            <span className="pay-track"><span style={{ transform: `scaleX(${s.paid / c.contractTotal})` }} /></span>
          </div>
          <ul className="pays">
            {c.payments.map((p) => (
              <li key={p.id} className={p.paid ? 'paid' : ''}>
                <span className="pays-ico">{p.paid ? <Icon name="check" size={16} /> : <Icon name="clock" size={16} />}</span>
                <span><b>{p.label}</b><span className="small muted num">{p.paid ? 'оплачено' : 'к оплате'} · {dateShort(p.due)}</span></span>
                <span className="num pays-amt">{rub(p.amount)}</span>
              </li>
            ))}
          </ul>
          {s.next && <p className="small muted">Следующий платёж — только после того, как вы примете этап по чек-листу.</p>}
        </section>
      </div>

      <section className="cab-photos" aria-labelledby="ph-t">
        <div className="cab-sec-head"><h3 id="ph-t" className="cab-h3">Фотоотчёт</h3><span className="small muted">иллюстрации вместо фото — это демо</span></div>
        <ul className="ph-feed">
          {[...c.photos].reverse().map((p) => (
            <li key={p.id}>
              <button className="ph" onClick={() => setPhoto(p)}>
                <StagePhoto scene={p.scene} title={p.caption} />
                <span className="ph-cap"><span className="mono">{dateShort(p.date)}</span>{p.caption}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="cab-card cab-chat" aria-labelledby="chat-t">
        <div className="cab-sec-head">
          <h3 id="chat-t" className="cab-h3">Сообщения от команды</h3>
          <div className="chat-act">
            <a className="btn btn-s btn-quiet" href={telHref(c.foreman.phone)}><Icon name="phone" size={16} /> Позвонить прорабу</a>
            <button className="btn btn-s btn-quiet" onClick={() => toast('Демо: здесь откроется чат с прорабом. Ничего не отправляется.')}><Icon name="chat" size={16} /> Написать</button>
          </div>
        </div>
        <ol className="chat">
          {[...c.updates].reverse().map((u) => {
            const ph = c.photos.find((x) => x.id === u.photoId);
            return (
              <li key={u.id} className="msg-i">
                <span className="msg-av" aria-hidden="true">{u.author.slice(0, 1)}</span>
                <div className="msg-b">
                  <span className="msg-meta"><b>{u.author}</b><span className="mono">{dateTime(u.at)}</span></span>
                  <p>{u.text}</p>
                  {ph && <button className="msg-ph" onClick={() => setPhoto(ph)}><StagePhoto scene={ph.scene} title={ph.caption} /></button>}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="small muted">Прораб: {c.foreman.name}, {c.foreman.phone}</p>
      </section>

      <Modal open={!!photo} onClose={() => setPhoto(null)} title={photo?.caption} wide>
        {photo && <div className="ph-big"><StagePhoto scene={photo.scene} title={photo.caption} /><p className="small muted">{dateLong(photo.date)} · {c.stages.find((x) => x.id === photo.stageId)?.title} · иллюстрация</p></div>}
      </Modal>
    </div>
  );
}
