import { api } from '../../api';
import { Icon } from '../../components/Icon';
import { useApi } from '../../lib/hooks';
import './faq.css';

export function Faq() {
  const { data: guarantees } = useApi(() => api.faq.list('guarantee'), [], ['faq']);
  const { data: faq } = useApi(() => api.faq.list('faq'), [], ['faq']);
  return (
    <section className="sheet faq" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-08</b><span>Гарантии и вопросы</span><i /></div>
        <ol className="gr-row strip-mask strip-mask-d-off" aria-label="Гарантии">
          {guarantees?.map((g, i) => (
            <li key={g.id} className="gr-item">
              <span className="gr-num display num">{String(i + 1).padStart(2, '0')}</span>
              <b><Icon name="shield" size={18} /> {g.q}</b>
              <span className="muted">{g.a}</span>
            </li>
          ))}
        </ol>
        <div className="faq-grid">
          <div className="faq-left">
            <h2 id="faq-title" className="display h2 rv">Что обычно <em>спрашивают</em></h2>
            <p className="lead rv">Ответы на вопросы, которые менеджеры слышат каждый день. Не нашли свой — спросите на замере.</p>
          </div>
          <div className="faq-list">
            {faq?.length === 0 && <p className="muted">Вопросов пока нет.</p>}
            {faq?.map((f) => (
              <details key={f.id} className="qa">
                <summary><span>{f.q}</span><Icon name="plus" size={20} /></summary>
                <div className="qa-a"><p>{f.a}</p></div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
