"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

import { ApiError, uploadDocument, type DocumentInfo } from "@/lib/api";

interface UploadPanelProps {
  onUploaded: (document: DocumentInfo) => void;
}

export default function UploadPanel({ onUploaded }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setFileName(file.name);
    setUploading(true);
    try {
      onUploaded(await uploadDocument(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed unexpectedly.");
      setUploading(false);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void handleFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (uploading) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        disabled={uploading}
      />
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed bg-white px-8 py-16 text-center shadow-sm transition-colors ${
          dragging ? "border-blue-500 bg-blue-50/60" : "border-zinc-200 hover:border-zinc-300"
        } ${uploading ? "cursor-default" : "cursor-pointer"}`}
      >
        {uploading ? (
          <>
            <svg
              className="h-9 w-9 animate-spin text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                d="M22 12a10 10 0 0 0-10-10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <p className="mt-5 text-sm font-medium text-zinc-900" role="status">
              Processing “{fileName}”
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-zinc-500">
              Extracting text, chunking, embedding, and classifying — this can take up to a minute.
            </p>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-zinc-200">
              <svg viewBox="0 0 20 20" className="h-6 w-6 text-zinc-500" fill="none" aria-hidden>
                <path
                  d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.5 13.5v1a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="mt-5 text-base font-medium text-zinc-900">Drag and drop a PDF here</p>
            <p className="mt-1.5 text-sm text-zinc-500">
              or{" "}
              <button
                type="button"
                className="font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                browse files
              </button>
            </p>
            <p className="mt-5 text-xs text-zinc-400">PDF · up to 20 MB</p>
          </>
        )}
      </div>
      {error && (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <svg
            viewBox="0 0 16 16"
            className="mt-0.5 h-4 w-4 shrink-0"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4ZM8 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
