import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UploadPanel from "@/components/UploadPanel";
import { ApiError, uploadDocument, type DocumentInfo } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  uploadDocument: vi.fn(),
}));

const mockUploadDocument = vi.mocked(uploadDocument);

const documentInfo: DocumentInfo = {
  document_id: "abc123",
  filename: "contract.pdf",
  num_pages: 3,
  num_chunks: 9,
  document_type: "Contract",
};

function selectPdf(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  const file = new File(["%PDF-1.4"], "contract.pdf", { type: "application/pdf" });
  fireEvent.change(input!, { target: { files: [file] } });
}

describe("UploadPanel", () => {
  it("uploads the selected file and passes the document to onUploaded", async () => {
    mockUploadDocument.mockResolvedValue(documentInfo);
    const onUploaded = vi.fn();

    const { container } = render(<UploadPanel onUploaded={onUploaded} />);
    selectPdf(container);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(documentInfo));
    expect(mockUploadDocument).toHaveBeenCalledWith(expect.any(File));
  });

  it("shows the backend error message and leaves the uploading state on failure", async () => {
    mockUploadDocument.mockRejectedValue(new ApiError("Only PDF files are accepted."));

    const { container } = render(<UploadPanel onUploaded={vi.fn()} />);
    selectPdf(container);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Only PDF files are accepted.");
    expect(screen.getByText("Drag and drop a PDF here")).toBeInTheDocument();
  });
});
