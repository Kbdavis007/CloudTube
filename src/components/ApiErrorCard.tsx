import React from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { parseGoogleApiError, splitLinks } from '../services/googleApiErrors';

/**
 * Renders an API failure with any embedded URL turned into a real button.
 *
 * Google error text often contains a console link, which is dead weight as plain
 * text on a touch device. When the message matches a known failure we show the
 * structured guidance; otherwise we still linkify any URL it contains.
 */
export const ApiErrorCard: React.FC<{
  message: string;
  title?: string;
  className?: string;
}> = ({ message, title, className }) => {
  const guide = parseGoogleApiError(message);

  if (guide) {
    return (
      <div
        className={
          className ??
          'p-4 rounded-2xl bg-red-950/40 border border-red-800/60 space-y-3 text-left'
        }
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-red-200">{title ?? guide.title}</p>
            <p className="text-xs text-red-100/80 leading-relaxed">{guide.explanation}</p>
          </div>
        </div>

        {guide.steps.length > 0 && (
          <ol className="list-decimal list-inside space-y-1 pl-6 text-xs text-slate-200">
            {guide.steps.map((step, i) => (
              <li key={i} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        )}

        {guide.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-6">
            {guide.actions.map((action) => (
              <a
                key={action.url}
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{action.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // No known pattern: still make any URL in the text tappable.
  const parts = splitLinks(message);
  return (
    <div
      className={
        className ?? 'p-4 rounded-2xl bg-red-950/40 border border-red-800/60 space-y-1 text-left'
      }
    >
      <p className="text-sm font-bold text-red-300">{title ?? 'Request failed'}</p>
      <p className="text-xs text-red-200/90 leading-relaxed break-words">
        {parts.map((part, i) =>
          part.url ? (
            <a
              key={i}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 underline underline-offset-2 break-all"
            >
              {part.text}
            </a>
          ) : (
            <React.Fragment key={i}>{part.text}</React.Fragment>
          )
        )}
      </p>
    </div>
  );
};
