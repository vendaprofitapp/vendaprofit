import { useState, useMemo, useCallback } from "react";

const PAGE_SIZE = 20;

/**
 * Paginação client-side com "Carregar mais".
 * Recebe a lista filtrada completa e retorna apenas os itens visíveis +
 * uma função para carregar a próxima página.
 *
 * Uso:
 *   const { visibleItems, hasMore, loadMore, resetPage } = useLoadMore(filteredList, 20);
 */
export function useLoadMore<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  // Reseta a página quando a lista muda (ex: novo filtro)
  const itemsLen = items.length;
  const [prevLen, setPrevLen] = useState(itemsLen);
  if (itemsLen !== prevLen) {
    setPrevLen(itemsLen);
    if (page !== 1) setPage(1);
  }

  const visibleItems = useMemo(
    () => items.slice(0, page * pageSize),
    [items, page, pageSize]
  );

  const hasMore = visibleItems.length < items.length;

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  return { visibleItems, hasMore, loadMore, resetPage, totalCount: items.length };
}
