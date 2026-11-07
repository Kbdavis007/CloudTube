import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface VideoPaginationProps {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

/**
 * First / Prev / page-count / Next / Last, shared by every paginated video list
 * so the control looks and behaves the same everywhere. Renders nothing when
 * there is only one page.
 */
export const VideoPagination: React.FC<VideoPaginationProps> = ({ page, pageCount, onPage }) => {
  if (pageCount <= 1) return null;

  const buttonClass =
    'px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold border border-slate-700 transition';

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-1" data-testid="video-pagination">
      <button onClick={() => onPage(0)} disabled={page === 0} className={buttonClass}>
        « First
      </button>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className={`${buttonClass} flex items-center gap-1`}
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Prev
      </button>
      <span className="px-2 text-xs text-slate-400">
        Page <span className="font-mono font-bold text-slate-200">{page + 1}</span> of{' '}
        <span className="font-mono font-bold text-slate-200">{pageCount}</span>
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount - 1}
        className={`${buttonClass} flex items-center gap-1`}
      >
        Next <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onPage(pageCount - 1)}
        disabled={page >= pageCount - 1}
        className={buttonClass}
      >
        Last »
      </button>
    </div>
  );
};
