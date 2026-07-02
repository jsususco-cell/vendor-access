"use client";

import { useState, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Set the PDF.js worker once — CDN source works reliably in Next.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function fileType(ext: string): "pdf" | "image" | "other" {
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  return "other";
}

/** Try to extract a file extension from a URL or filename string. */
function extFrom(str: string): string {
  // Strip query params, hash, and trailing slash
  const clean = str.split("?")[0].split("#")[0].replace(/\/$/, "");
  const last = clean.split("/").pop() ?? "";
  return last.includes(".") ? last.split(".").pop()?.toLowerCase() ?? "" : "";
}

/** Derive a usable download filename: prefer the label, but ensure it has the extension from the URL. */
function safeFileName(label: string, rawUrl: string): string {
  const labelExt = extFrom(label);
  if (labelExt) return label; // already has an extension

  const urlExt = extFrom(rawUrl);
  if (urlExt) return `${label}.${urlExt}`;
  return label;
}

export default function FileViewer({
  fileName,
  proxyUrl,
  rawUrl,
  onClose,
}: {
  fileName: string;
  proxyUrl: string;
  rawUrl: string;
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);

  const downloadName = useMemo(() => safeFileName(fileName, rawUrl), [fileName, rawUrl]);
  const ext = useMemo(() => extFrom(fileName) || extFrom(rawUrl), [fileName, rawUrl]);
  const kind = fileType(ext);

  function onDocLoadSuccess({ numPages: total }: { numPages: number }) {
    setNumPages(total);
    setPageNumber(1);
  }

  return (
    <div className="fv-overlay" onClick={onClose}>
      <div className="fv-shell" onClick={(e) => e.stopPropagation()}>
        <div className="fv-head">
          <h2>{fileName}</h2>
          <div className="fv-actions">
            <a className="fv-dl" href={proxyUrl} download={downloadName} title="Download">
              &#x2913;
            </a>
            <button className="modal-x" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
        </div>

        <div className="fv-body">
          {/* PDF viewer via react-pdf */}
          {kind === "pdf" && !error && (
            <div className="fv-pdf-wrap">
              <Document
                file={proxyUrl}
                onLoadSuccess={onDocLoadSuccess}
                onLoadError={() => setError(true)}
                loading={<div className="fv-loading">Loading PDF&hellip;</div>}
                error={<div className="fv-fallback"><p>Unable to load this PDF.</p><a href={proxyUrl} download={downloadName}>Download {downloadName}</a></div>}
              >
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer
                  renderAnnotationLayer
                  width={760}
                  loading={<div className="fv-loading">Rendering page&hellip;</div>}
                />
              </Document>

              {numPages > 1 && (
                <div className="fv-pages">
                  <button
                    className="fv-pg-btn"
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  >
                    &lsaquo; Prev
                  </button>
                  <span className="fv-pg-info">
                    {pageNumber} / {numPages}
                  </span>
                  <button
                    className="fv-pg-btn"
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                  >
                    Next &rsaquo;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Image viewer */}
          {kind === "image" && !imageError && (
            <img
              src={proxyUrl}
              className="fv-img"
              alt={fileName}
              onError={() => setImageError(true)}
            />
          )}
          {kind === "image" && imageError && (
            <div className="fv-fallback">
              <p>Unable to load this image.</p>
              <a href={proxyUrl} download={downloadName}>
                Download {downloadName}
              </a>
            </div>
          )}

          {/* Other file types */}
          {kind === "other" && (
            <div className="fv-fallback">
              <p>This file type cannot be previewed in the browser.</p>
              <a href={proxyUrl} download={downloadName}>
                Download {downloadName}
              </a>
            </div>
          )}

          {/* Generic error fallback */}
          {kind === "pdf" && error && (
            <div className="fv-fallback">
              <p>Unable to preview this file.</p>
              <a href={proxyUrl} download={downloadName}>
                Download {downloadName}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
