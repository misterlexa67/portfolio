import { useEffect, useState } from 'react';
import { api, type SiteTexts } from '../api';
import { Icon } from '../components/Icon';
import { Spinner, useToast } from '../components/ui';
import { humanError, useApi } from '../lib/hooks';
import { AdmHead } from './AdminApp';

const CONTACTS: { key: keyof SiteTexts['contacts']; label: string }[] = [
  { key: 'phone', label: 'Телефон' }, { key: 'email', label: 'Почта' }, { key: 'address', label: 'Адрес' }, { key: 'hours', label: 'Часы работы' },
  { key: 'telegram', label: 'Telegram' }, { key: 'max', label: 'MAX' }, { key: 'whatsapp', label: 'WhatsApp' },
];

export function TextsAdmin() {
  const { data } = useApi(() => api.texts.get(), [], ['texts']);
  const [t, setT] = useState<SiteTexts | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => { if (data) setT(data); }, [data]);
  if (!t || !data) return <div className="adm-page muted">Загружаем тексты…</div>;
  const dirty = JSON.stringify(t) !== JSON.stringify(data);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.texts.save(t); toast('Тексты сохранены — они уже на сайте', 'ok'); } catch (e) { setErr(humanError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="adm-page">
      <AdmHead title="Тексты сайта" sub="Заголовок, обещания, гарантия цены и контакты — без программиста.">
        <button className="btn btn-s btn-quiet" onClick={() => setT(data)} disabled={!dirty}>Отменить</button>
        <button className="btn btn-s btn-primary" onClick={save} disabled={!dirty || busy}>{busy ? <Spinner /> : <Icon name="check" size={16} />} Сохранить</button>
      </AdmHead>
      {err && <p className="err" role="alert">{err}</p>}

      <section className="adm-card">
        <h2 className="adm-h2">Первый экран</h2>
        <div className="text-preview" aria-label="Превью заголовка">
          <span className="mono small muted">Превью</span>
          <p className="display">{t.heroTitle} <em>{t.heroAccent}</em></p>
          <p className="small muted">{t.heroLead}</p>
        </div>
        <label className="field"><span>Заголовок</span><input className="input" value={t.heroTitle} onChange={(e) => setT({ ...t, heroTitle: e.target.value })} /></label>
        <label className="field"><span>Выделенные слова в конце (курсив, цвет)</span><input className="input" value={t.heroAccent} onChange={(e) => setT({ ...t, heroAccent: e.target.value })} /></label>
        <label className="field"><span>Подзаголовок</span><textarea className="input" value={t.heroLead} onChange={(e) => setT({ ...t, heroLead: e.target.value })} /></label>
      </section>

      <section className="adm-card">
        <h2 className="adm-h2">Обещания под первым экраном</h2>
        {t.promises.map((p, i) => (
          <div key={i} className="nf-row">
            <label className="field"><span>Обещание {i + 1}</span><input className="input" value={p.title} onChange={(e) => setT({ ...t, promises: t.promises.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} /></label>
            <label className="field nf-wide"><span>Пояснение</span><input className="input" value={p.text} onChange={(e) => setT({ ...t, promises: t.promises.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} /></label>
          </div>
        ))}
        <label className="field"><span>Гарантия цены (в смете, договоре и PDF)</span><input className="input" value={t.fixedPromise} onChange={(e) => setT({ ...t, fixedPromise: e.target.value })} /></label>
      </section>

      <section className="adm-card">
        <h2 className="adm-h2">Контакты</h2>
        <div className="nf-grid">
          {CONTACTS.map((c) => (
            <label key={c.key} className="field"><span>{c.label}</span><input className="input" value={t.contacts[c.key]} onChange={(e) => setT({ ...t, contacts: { ...t.contacts, [c.key]: e.target.value } })} /></label>
          ))}
        </div>
      </section>
    </div>
  );
}
