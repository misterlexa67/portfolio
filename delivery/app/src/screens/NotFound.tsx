import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <div className="screen container page-pad">
      <EmptyState
        art="search"
        title="Такой страницы нет"
        text="Возможно, ссылка устарела. Зато рестораны на месте."
        action={<Link to="/" className="btn btn--primary btn--md"><span className="btn__content">На главную</span></Link>}
      />
    </div>
  );
}
