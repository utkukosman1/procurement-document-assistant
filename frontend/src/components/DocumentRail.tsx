import type { DocumentInfo } from "@/lib/api";

interface DocumentRailProps {
  document: DocumentInfo;
}

export default function DocumentRail({ document }: DocumentRailProps) {
  return (
    <aside className="md:w-56 md:shrink-0">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 ring-1 ring-zinc-200 ring-inset">
          <svg viewBox="0 0 20 20" className="h-4.5 w-4.5 text-zinc-500" fill="none" aria-hidden>
            <path
              d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="mt-2.5 truncate text-sm font-medium text-zinc-900" title={document.filename}>
          {document.filename}
        </p>
        <p className="mt-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200/70 ring-inset">
            {document.document_type}
          </span>
        </p>
        <dl className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-zinc-100 pt-3.5">
          <div>
            <dt className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
              Pages
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-medium text-zinc-900">
              {document.num_pages}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
              Chunks
            </dt>
            <dd className="mt-0.5 font-mono text-sm font-medium text-zinc-900">
              {document.num_chunks}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
