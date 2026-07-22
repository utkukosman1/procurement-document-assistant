import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, askQuestion } from "@/lib/api";

describe("api error handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces the backend's detail message on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "Document not found." }), { status: 404 }),
        ),
    );

    const promise = askQuestion("missing-doc", "When is payment due?");

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toThrow("Document not found.");
  });

  it("throws a friendly message when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(askQuestion("doc-1", "question")).rejects.toThrow(
      "Could not reach the backend. Is the API server running?",
    );
  });
});
