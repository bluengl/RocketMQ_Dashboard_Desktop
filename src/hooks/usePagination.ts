import { useMemo, useState } from 'react'

export function usePagination<T>(items: T[], initialPageSize = 20) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize]
  )

  const setPageSize = (size: number) => {
    setPageSizeState(size)
    setPage(1)
  }

  return {
    page: currentPage,
    pageSize,
    total: items.length,
    totalPages,
    setPage,
    setPageSize,
    pageItems,
  }
}
