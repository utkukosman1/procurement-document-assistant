import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChatPanel from "@/components/ChatPanel";
import { askQuestion, type ChatResponse } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  askQuestion: vi.fn(),
}));

const mockAskQuestion = vi.mocked(askQuestion);

const summary: ChatResponse = { answer: "A supply contract between two parties.", citations: [] };

function renderPanel() {
  return render(<ChatPanel documentId="doc-1" filename="contract.pdf" documentType="Contract" />);
}

describe("ChatPanel", () => {
  beforeEach(() => {
    mockAskQuestion.mockReset();
  });

  it("renders the question and the cited answer after submitting", async () => {
    // First call is the mount-time auto-summary, second is the user's question.
    mockAskQuestion.mockResolvedValueOnce(summary).mockResolvedValueOnce({
      answer: "Payment is due within 30 days of invoice.",
      citations: [
        {
          page_number: 4,
          chunk_index: 11,
          // Subsection heading without a separator after the number — the format
          // the backend chunker emits for nested sections ("2.3 Fees", "4.2 Payment").
          snippet: "4.2 Payment. Payment is due within 30 days of invoice.",
        },
      ],
    });

    renderPanel();
    await screen.findByText(summary.answer);

    fireEvent.change(screen.getByPlaceholderText("Ask a question about the document…"), {
      target: { value: "When is payment due?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Payment is due within 30 days of invoice.")).toBeVisible();
    expect(screen.getByText("When is payment due?")).toBeVisible();
    expect(screen.getByText("p. 4")).toBeVisible();
    expect(screen.getByText("4.2 Payment")).toBeVisible();
  });

  it("collapses citations with the same page and section, keeps distinct sections", async () => {
    // Same page, same heading twice: rendered as a single source chip.
    mockAskQuestion.mockResolvedValueOnce({
      answer: "Summary.",
      citations: [
        { page_number: 4, chunk_index: 11, snippet: "4.2 Payment. Payment is due in 30 days." },
        { page_number: 4, chunk_index: 12, snippet: "4.2 Payment. A late fee of 2 % applies." },
      ],
    });
    const first = renderPanel();
    await screen.findByText("Summary.");
    expect(screen.getAllByText("p. 4")).toHaveLength(1);
    first.unmount();

    // Same page, different headings: both chips survive the dedup.
    mockAskQuestion.mockResolvedValueOnce({
      answer: "Summary.",
      citations: [
        { page_number: 4, chunk_index: 11, snippet: "4.2 Payment. Payment is due in 30 days." },
        { page_number: 4, chunk_index: 13, snippet: "4.3 Termination. Either party may exit." },
      ],
    });
    renderPanel();
    await screen.findByText("Summary.");
    expect(screen.getAllByText("p. 4")).toHaveLength(2);
    expect(screen.getByText("4.2 Payment")).toBeVisible();
    expect(screen.getByText("4.3 Termination")).toBeVisible();
  });
});
