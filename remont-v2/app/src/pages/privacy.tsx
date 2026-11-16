import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../styles/controls.css';
import '../sections/chrome/chrome.css';
import { Logo } from '../sections/chrome/Chrome';

function Privacy() {
  return (
    <>
      <div className="demobar"><span className="mono">Демо-концепт, бизнес вымышленный</span></div>
      <main className="wrap" style={{ maxWidth: 760, padding: '32px 16px 80px', display: 'grid', gap: 18 }}>
        <Logo href="../" />
        <h1 className="display" style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)' }}>Политика конфиденциальности</h1>
        <p className="tag tag-clay" style={{ justifySelf: 'start', whiteSpace: 'normal' }}>Образец для демо-сайта. Компания «Метр» вымышленная, данные никуда не передаются.</p>
        <h2 className="display" style={{ fontSize: '1.6rem' }}>Какие данные мы собираем</h2>
        <p>Имя, номер телефона и параметры расчёта ремонта (площадь, тип дома, тип ремонта, опции), если вы сами оставили их в форме записи на замер или при запросе сметы.</p>
        <h2 className="display" style={{ fontSize: '1.6rem' }}>Зачем</h2>
        <p>Чтобы связаться с вами, назначить замер и подготовить смету. Мы не используем данные для рассылок без вашего согласия и не передаём их третьим лицам.</p>
        <h2 className="display" style={{ fontSize: '1.6rem' }}>Где хранятся данные в демо</h2>
        <p>Только в вашем браузере (localStorage). Ничего не отправляется на сервер, в мессенджеры или в CRM. Очистите данные сайта в браузере — и они исчезнут.</p>
        <h2 className="display" style={{ fontSize: '1.6rem' }}>Ваши права</h2>
        <p>В реальном сервисе вы могли бы запросить, исправить или удалить свои данные, написав на почту компании. Согласие можно отозвать в любой момент.</p>
        <a className="link" href="../">← Вернуться на сайт</a>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Privacy /></StrictMode>);
