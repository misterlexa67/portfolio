import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe, toFriendly, type ApiError, type Topic } from '../api';

export interface QueryState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;       // первая загрузка — показываем скелетон
  refreshing: boolean;    // фоновое обновление — данные на экране остаются
  reload: () => void;
}

/**
 * Запрос к сервисному слою с автообновлением, когда сервис сообщает об изменениях
 * в нужных разделах (например, владелец выключил блюдо в админке).
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[], topics: Topic[] = []): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const hasData = useRef(false);

  const run = useCallback((silent: boolean) => {
    const id = ++seq.current;
    if (!silent) { setLoading(!hasData.current); setError(null); }
    setRefreshing(true);
    fetchRef.current().then(
      (v) => {
        if (id !== seq.current) return;
        hasData.current = true;
        setData(v);
        setError(null);
        setLoading(false);
        setRefreshing(false);
      },
      (e) => {
        if (id !== seq.current) return;
        if (!silent || !hasData.current) setError(toFriendly(e));
        setLoading(false);
        setRefreshing(false);
      },
    );
  }, []);

  useEffect(() => {
    hasData.current = false;
    setData(undefined);
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const topicsKey = topics.join(',');
  useEffect(() => {
    if (!topics.length) return undefined;
    return subscribe((changed) => {
      if (changed.some((t) => topics.includes(t))) run(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey, run]);

  return { data, error, loading, refreshing, reload: () => run(false) };
}
