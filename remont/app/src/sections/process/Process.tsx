import { useState } from 'react';
import { api } from '../../api';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/ui';
import { useApi } from '../../lib/hooks';
import { useTexts } from '../shared';
import './process.css';

const STEPS = [
  { t: 'Замер', d: '1 день', x: 'Инженер приезжает бесплатно, делает обмерный план и фото.' },
  { t: 'Смета', d: '2 дня', x: 'Точная смета по этапам с объёмами и материалами.' },
  { t: 'Договор', d: '1 день', x: 'Фиксируем цену, сроки по этапам и неустойку.' },
  { t: 'Черновые', d: '3–6 недель', x: 'Демонтаж, стяжка, стены, электрика, сантехника.' },
  { t: 'Чистовые', d: '3–7 недель', x: 'Плитка, покраска, полы, двери, потолки.' },
  { t: 'Сдача', d: '2–3 дня', x: 'Приёмка по чек-листу, клининг, ключи и гарантия.' },
];

export function Process() {
  const texts = useTexts();
  const { data: settings } = useApi(() => api.estimates.getSettings(), [], ['settings']);
  const [contract, setContract] = useState(false);
  const pays = settings?.payments ?? [];

  return (
    <section className="sheet process" id="process" aria-labelledby="process-title">
      <div className="wrap">
        <div className="sheet-label"><b>Л-07</b><span>Как мы работаем</span><i /><span>этапы и оплата</span></div>
        <div className="pr-head">
          <h2 id="process-title" className="display h2 rv">Платите <em>за сделанное</em>, а не вперёд</h2>
          <p className="lead rv">Шесть шагов от замера до ключей. Деньги — частями, и каждая часть только после того, как вы приняли этап.</p>
        </div>

        <ol className="pr-track">
          {STEPS.map((s, i) => {
            return (
              <li key={s.t} className="pr-step rv">
                <span className="pr-n mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="pr-node" aria-hidden="true" />
                <b className="pr-t">{s.t}</b>
                <span className="pr-d mono">{s.d}</span>
                <span className="small muted pr-x">{s.x}</span>
              </li>
            );
          })}
        </ol>

        {pays.length > 0 && (
          <div className="pr-pay-block rv">
            <h3 className="pr-pay-h">Оплата — четырьмя частями, каждая после приёмки</h3>
            <div className="pr-scale" aria-label="Шкала оплаты по этапам">
              {pays.map((p, i) => (
                <div key={p.id} className="pr-seg" style={{ flexGrow: p.percent }}>
                  <span className="pr-pct display num">{p.percent}%</span>
                  <span className={`pr-bar${i === 0 ? ' first' : ''}`} />
                  <span className="pr-after">{p.after}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <figure className="pr-promise rv">
          <Icon name="lock" size={28} />
          <blockquote className="display">{texts?.fixedPromise ?? 'Смета фиксируется в договоре. Цена не изменится'}</blockquote>
          <figcaption className="muted">Если мы ошиблись в объёмах — это наш риск, а не ваша доплата. Цена меняется только если вы сами решите что-то добавить, и только с вашей подписью.</figcaption>
          <button className="btn btn-ghost" onClick={() => setContract(true)}><Icon name="doc" size={18} /> Посмотреть пример договора</button>
        </figure>
      </div>

      <Modal open={contract} onClose={() => setContract(false)} title="Пример договора" wide>
        <article className="contract">
          <span className="contract-mark" aria-hidden="true">ОБРАЗЕЦ</span>
          <p className="tag tag-clay">Образец для ознакомления · не является офертой · бизнес вымышленный</p>
          <h4>Договор подряда на ремонт квартиры № ____</h4>
          <p className="muted small">г. Нижний Новгород · «___» ________ 20__ г.</p>
          <p>ООО «Метр» (Подрядчик) и [ФИО заказчика] (Заказчик) заключили договор о нижеследующем.</p>
          <h5>1. Предмет</h5>
          <p>Подрядчик выполняет ремонт квартиры по адресу [адрес] в объёме согласно Смете (Приложение 1) и Графику работ (Приложение 2).</p>
          <h5>2. Цена</h5>
          <p><mark>2.1. Цена работ и черновых материалов определена Сметой и является твёрдой. Цена не подлежит изменению в одностороннем порядке, в том числе при росте цен на материалы и при ошибке Подрядчика в объёмах.</mark></p>
          <p>2.2. Цена может быть изменена только по письменному дополнительному соглашению по инициативе Заказчика.</p>
          <h5>3. Порядок оплаты</h5>
          <ul>{pays.map((p) => <li key={p.id}>{p.percent}% — {p.after};</li>)}</ul>
          <p>Оплата очередного этапа производится только после подписания акта приёмки предыдущего.</p>
          <h5>4. Сроки</h5>
          <p>4.1. Сроки этапов указаны в Графике работ. 4.2. <mark>За нарушение сроков Подрядчик уплачивает неустойку 0,1% от цены договора за каждый день просрочки.</mark></p>
          <h5>5. Приёмка и гарантия</h5>
          <p>5.1. Каждый этап принимается по чек-листу. 5.2. Гарантийный срок на работы — 3 года с даты подписания итогового акта. Дефекты устраняются за счёт Подрядчика в течение 10 дней.</p>
          <h5>6. Отчётность</h5>
          <p>Подрядчик ежедневно публикует фотоотчёт в личном кабинете Заказчика.</p>
          <p className="muted small">Приложения: 1. Смета. 2. График работ. 3. Ведомость материалов. 4. Чек-листы приёмки.</p>
        </article>
      </Modal>
    </section>
  );
}
