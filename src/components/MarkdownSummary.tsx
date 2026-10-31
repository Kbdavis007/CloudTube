import React from 'react';

/**
 * Minimal, dependency-free markdown renderer for AI-generated summaries.
 *
 * Gemini returns markdown (headings, bullet lists, bold, inline code) but the
 * summary pane used to print it verbatim, so the user saw literal `**` and `-`
 * characters. This renders the subset the prompts actually emit and styles it
 * like a Google AI overview: an accent-ruled heading, marker-prefixed list
 * items, and generous spacing between blocks.
 *
 * Everything is emitted as React nodes rather than HTML, so no user- or
 * model-supplied string is ever interpreted as markup.
 */

interface MarkdownSummaryProps {
  markdown: string;
  className?: string;
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'hr' };

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
// `•` is included because older cached summaries were generated before the prompt
// asked for `- ` bullets and the model often emitted a literal bullet character.
const UL_RE = /^\s*[-*+•]\s+(.*)$/;
const OL_RE = /^\s*\d+[.)]\s+(.*)$/;
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const FENCE_RE = /^\s*```/;

/** Splits markdown into block-level nodes, grouping consecutive list items. */
function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      flushParagraph();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    if (HR_RE.test(line)) {
      flushParagraph();
      blocks.push({ type: 'hr' });
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      continue;
    }

    const quote = line.match(QUOTE_RE);
    if (quote) {
      flushParagraph();
      const quoted = [quote[1]];
      while (i + 1 < lines.length && QUOTE_RE.test(lines[i + 1])) {
        i += 1;
        quoted.push(lines[i].match(QUOTE_RE)![1]);
      }
      blocks.push({ type: 'quote', text: quoted.join(' ').trim() });
      continue;
    }

    if (UL_RE.test(line) || OL_RE.test(line)) {
      flushParagraph();
      const ordered = OL_RE.test(line);
      const items: string[] = [];
      const itemRe = ordered ? OL_RE : UL_RE;
      while (i < lines.length && itemRe.test(lines[i])) {
        items.push(lines[i].match(itemRe)![1].trim());
        i += 1;
      }
      i -= 1;
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}

const INLINE_PATTERN =
  '(`[^`]+`)|(\\*\\*[^*]+\\*\\*)|(__[^_]+__)|(\\*[^*]+\\*)|(_[^_]+_)|(\\[[^\\]]+\\]\\([^)\\s]+\\))';

/** Renders inline emphasis, code spans and links inside a block of text. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  // A fresh regex per call: the recursive bold/italic cases would otherwise
  // clobber a shared `lastIndex` and spin forever.
  const re = new RegExp(INLINE_PATTERN, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [token] = match;
    const key = `${match.index}-${token}`;

    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/70 text-[11px] font-mono text-orange-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {renderInline(token.slice(2, -2))}
        </strong>
      );
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(
        <em key={key} className="italic text-slate-200">
          {renderInline(token.slice(1, -1))}
        </em>
      );
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      nodes.push(
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="text-orange-400 underline decoration-orange-400/40 hover:decoration-orange-400"
        >
          {link[1]}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

const HEADING_STYLES: Record<1 | 2 | 3, string> = {
  1: 'text-sm font-bold text-white',
  2: 'text-xs font-bold text-white uppercase tracking-wide',
  3: 'text-xs font-semibold text-slate-100',
};

export const MarkdownSummary: React.FC<MarkdownSummaryProps> = ({ markdown, className }) => {
  const blocks = parseBlocks(markdown);

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return (
              <h4
                key={idx}
                className={`flex items-center gap-2 pt-1 ${HEADING_STYLES[block.level]}`}
              >
                <span className="w-1 h-3.5 rounded-full bg-orange-500 shrink-0" />
                <span>{renderInline(block.text)}</span>
              </h4>
            );
          case 'ul':
            return (
              <ul key={idx} className="space-y-1.5">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400/80 shrink-0" />
                    <span className="flex-1">{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="space-y-1.5">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-md bg-orange-500/20 border border-orange-500/30 text-[10px] font-bold text-orange-300 shrink-0">
                      {itemIdx + 1}
                    </span>
                    <span className="flex-1">{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote
                key={idx}
                className="pl-3 border-l-2 border-orange-500/50 text-slate-300 italic"
              >
                {renderInline(block.text)}
              </blockquote>
            );
          case 'code':
            return (
              <pre
                key={idx}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto"
              >
                <code>{block.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={idx} className="border-slate-800" />;
          default:
            return (
              <p key={idx} className="leading-relaxed">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
};
