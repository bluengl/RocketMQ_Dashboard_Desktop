import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../i18n'
import Select from './Select'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export default function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const { t } = useI18n()
  if (total === 0) return null

  return (
    <div className="rmq-pagination flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-700 text-xs text-slate-400">
      <span>
        {total.toLocaleString()} {t(total === 1 ? 'item' : 'items')} · {t('Page {page} of {totalPages}', { page, totalPages })}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select
            compact
            value={String(pageSize)}
            options={[10, 20, 50, 100].map((size) => ({
              value: String(size),
              label: `${size} ${t('per page')}`,
            }))}
            onChange={(value) => onPageSizeChange(Number(value))}
            ariaLabel={t('Rows per page')}
          />
        )}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          title={t('Previous page')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          title={t('Next page')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
