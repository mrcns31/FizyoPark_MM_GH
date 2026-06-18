import { useEffect, useState } from 'react';

/**
 * İstemci-taraflı kademeli liste. Tüm veri zaten bellekte (web admin gibi tek fetch);
 * aşağı çekildikçe `step` kadar daha gösterilir. `resetKey` (arama/harf filtresi) değişince
 * baştan başlar. Büyük listelerde ilk render'ı hafifletir + sonsuz kaydırma hissi verir.
 */
export function useIncremental<T>(
  items: T[],
  opts?: { step?: number; resetKey?: string },
): { visible: T[]; hasMore: boolean; loadMore: () => void } {
  const step = opts?.step ?? 25;
  const resetKey = opts?.resetKey ?? '';
  const [count, setCount] = useState(step);

  useEffect(() => {
    setCount(step);
  }, [resetKey, step]);

  const visible = items.slice(0, count);
  const hasMore = count < items.length;
  const loadMore = () => setCount((c) => (c < items.length ? c + step : c));

  return { visible, hasMore, loadMore };
}
