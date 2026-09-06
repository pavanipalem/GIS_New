import { useRef, useState } from "react";
import { tokenStore } from "../api/tokenStore";
import { ApiError } from "../api/client";

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000/api";

export type BulkKind = "towers" | "lines" | "solar-plants" | "ehv-consumers";

interface ImportRowError {
  row: number;
  message: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
}

/** Downloads go through fetch rather than a plain link because the endpoints
 * need the Authorization header - a bare href would arrive unauthenticated. */
async function download(path: string, filename: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${tokenStore.getAccess() ?? ""}` },
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkExcel({
  kind,
  feederId,
  canEdit,
  onImported,
}: {
  kind: BulkKind;
  /** Towers are always scoped to one line - the sheet does not carry it. */
  feederId?: number;
  canEdit: boolean;
  onImported?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scope = feederId !== undefined ? `?feeder_id=${feederId}` : "";
  const suffix = feederId !== undefined ? `-feeder-${feederId}` : "";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    await run(async () => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${BASE_URL}/bulk/${kind}/import${scope}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenStore.getAccess() ?? ""}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.detail ?? res.statusText);
      setResult(data as ImportResult);
      if (!data.errors?.length) onImported?.();
    });
  };

  return (
    <div className="bulk-excel">
      <div className="bulk-actions">
        <button
          type="button"
          className="link-button"
          disabled={busy}
          onClick={() =>
            run(() => download(`/bulk/${kind}/template.xlsx`, `${kind}-template.xlsx`))
          }
        >
          Download blank template
        </button>
        <button
          type="button"
          className="link-button"
          disabled={busy}
          onClick={() =>
            run(() => download(`/bulk/${kind}/export.xlsx${scope}`, `${kind}${suffix}.xlsx`))
          }
        >
          Export to Excel
        </button>
        {canEdit && (
          <>
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Working…" : "Import from Excel"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      <p className="hint">
        Rows that keep their id column update that record; rows with a blank id are added. If any
        row is rejected, nothing in the file is applied — fix it and upload again.
      </p>

      {error && <p className="auth-error">{error}</p>}

      {result && (
        <div className={result.errors.length ? "notice notice-warn" : "notice"}>
          {result.errors.length === 0 ? (
            <>
              Imported: {result.created} added, {result.updated} updated.
            </>
          ) : (
            <>
              <strong>Nothing was imported.</strong> {result.errors.length} row
              {result.errors.length === 1 ? "" : "s"} need fixing:
              <ul className="bulk-errors">
                {result.errors.slice(0, 15).map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
              {result.errors.length > 15 && <>…and {result.errors.length - 15} more.</>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
