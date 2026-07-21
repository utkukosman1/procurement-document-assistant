"use client";

import { useState } from "react";

import ChatPanel from "@/components/ChatPanel";
import DocumentRail from "@/components/DocumentRail";
import UploadPanel from "@/components/UploadPanel";
import type { DocumentInfo } from "@/lib/api";

function BrandMark() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M8 1.5c.3 2.9 2.6 5.2 5.5 5.5v2c-2.9.3-5.2 2.6-5.5 5.5h-.1C7.6 11.6 5.3 9.3 2.4 9v-2c2.9-.3 5.2-2.6 5.5-5.5H8Z" />
      </svg>
    </span>
  );
}

export default function Home() {
  const [document, setDocument] = useState<DocumentInfo | null>(null);

  function handleReset() {
    setDocument(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center gap-3 px-6">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight">Procurement Assistant</span>
          {document && (
            <button
              type="button"
              onClick={handleReset}
              className="ml-auto rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              New document
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-10">
        {document === null ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center">
            <div className="mb-8 max-w-md text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Analyze a procurement document
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Upload a PDF to classify it, then ask questions answered from the document itself —
                every answer cites the pages it came from.
              </p>
            </div>
            <UploadPanel onUploaded={setDocument} />
          </div>
        ) : (
          <div className="flex flex-col gap-6 md:h-[75vh] md:max-h-[860px] md:min-h-[520px] md:flex-row">
            <DocumentRail document={document} />
            <ChatPanel
              key={document.document_id}
              documentId={document.document_id}
              filename={document.filename}
              documentType={document.document_type}
            />
          </div>
        )}
      </main>
    </div>
  );
}
