import { useDeferredValue, useRef, useState, type RefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage, type DocumentSummary } from "../api";
import { useSession } from "../session";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string): string {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Needs attention";
  return status.replaceAll("_", " ");
}

function DocumentRow({
  document,
  selected,
  onSelect,
}: {
  document: DocumentSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`document-row ${selected ? "selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="document-identity">
        <span className="pdf-sheet" aria-hidden="true">
          PDF
        </span>
        <span>
          <strong>{document.displayName}</strong>
          <small>{formatBytes(document.sizeBytes)}</small>
        </span>
      </span>
      <span className={`document-status status-${document.status}`}>
        <i aria-hidden="true" />
        {statusLabel(document.status)}
      </span>
      <span>{document.pageCount ?? "—"}</span>
      <time dateTime={document.updatedAt}>{new Date(document.updatedAt).toLocaleDateString()}</time>
      <span className="row-selection">{selected ? "Selected" : "Select"}</span>
    </button>
  );
}

function UploadDialog({
  busy,
  error,
  inputRef,
  onClose,
  onChoose,
}: {
  busy: boolean;
  error: unknown;
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onChoose: (file: File) => void;
}) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close upload" />
      <section className="modal-panel">
        <button className="modal-close" onClick={onClose} aria-label="Close upload">
          <X size={18} />
        </button>
        <span className="modal-index">01 / Upload</span>
        <h2 id="upload-title">Add a PDF</h2>
        <p>The file is validated before direct upload, then processed by a background worker.</p>
        <button className="file-picker" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload size={20} />
          <strong>{busy ? "Uploading…" : "Choose a PDF file"}</strong>
          <span>Maximum 100 MB and 500 pages</span>
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onChoose(file);
          }}
        />
        {error ? (
          <div className="form-error" role="alert">
            {errorMessage(error)}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CollectionDialog({
  name,
  description,
  documentCount,
  busy,
  error,
  onNameChange,
  onDescriptionChange,
  onClose,
  onSubmit,
}: {
  name: string;
  description: string;
  documentCount: number;
  busy: boolean;
  error: unknown;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="collection-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close collection" />
      <form
        className="modal-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close collection"
        >
          <X size={18} />
        </button>
        <span className="modal-index">02 / Organize</span>
        <h2 id="collection-title">Create a collection</h2>
        <p>Group selected documents now, or create an empty collection for later.</p>
        <label className="field">
          <span>Name</span>
          <input
            required
            minLength={1}
            maxLength={100}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>
            Description <small>optional</small>
          </span>
          <textarea
            maxLength={500}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="primary-button modal-submit"
          disabled={busy || !name.trim()}
        >
          {busy ? "Creating…" : `Create collection (${documentCount})`}
        </button>
        {error ? (
          <div className="form-error" role="alert">
            {errorMessage(error)}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export function DocumentsPage() {
  const { profile } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const workspace = profile?.workspaces[0];

  const documents = useQuery({
    queryKey: ["documents", workspace?.id, deferredQuery],
    queryFn: () => api.documents(workspace?.id ?? "", deferredQuery),
    enabled: Boolean(workspace),
    refetchInterval: (result) =>
      result.state.data?.some((item) => !["ready", "failed", "cancelled"].includes(item.status))
        ? 3_000
        : false,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!workspace) throw new Error("No workspace is available.");
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
        throw new Error("Choose a PDF file.");
      await api.upload(workspace.id, file);
    },
    onSuccess: async () => {
      setUploadOpen(false);
      setNotice("Upload stored. Background processing has started.");
      await queryClient.invalidateQueries({ queryKey: ["documents", workspace?.id] });
    },
  });
  const createConversation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No workspace is available.");
      const readyIds = selected.filter(
        (documentId) => documents.data?.find((item) => item.id === documentId)?.status === "ready",
      );
      if (readyIds.length === 0) throw new Error("Select at least one ready document.");
      return api.createConversation(workspace.id, readyIds);
    },
    onSuccess: (conversation) => navigate(`/ask/${conversation.id}`),
  });
  const createCollection = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No workspace is available.");
      return api.createCollection(workspace.id, collectionName, collectionDescription, selected);
    },
    onSuccess: (collection) => {
      setCollectionOpen(false);
      setCollectionName("");
      setCollectionDescription("");
      setNotice(`Collection “${collection.name}” was created.`);
    },
  });

  const readyCount = documents.data?.filter((item) => item.status === "ready").length ?? 0;
  const operationError =
    documents.error ?? upload.error ?? createConversation.error ?? createCollection.error;

  return (
    <div className="page documents-page">
      <header className="page-heading">
        <div>
          <h1>Your documents</h1>
          <p>Upload a PDF, wait for processing, then ask questions backed by page citations.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => setCollectionOpen(true)}>
            New collection
          </button>
          <button className="primary-button" onClick={() => setUploadOpen(true)}>
            Upload PDF
          </button>
        </div>
      </header>
      <div className="document-summary" aria-label="Document summary">
        <p>
          <strong>{documents.data?.length ?? 0}</strong> shown
        </p>
        <p>
          <strong>{readyCount}</strong> ready to ask
        </p>
        <p>Every answer requires page evidence.</p>
      </div>
      {notice ? (
        <div className="success-banner" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      ) : null}
      <div className="content-toolbar">
        <label className="document-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stored documents"
            aria-label="Search stored documents"
          />
        </label>
        {selected.length > 0 ? (
          <button
            className="primary-button"
            onClick={() => createConversation.mutate()}
            disabled={createConversation.isPending}
          >
            {createConversation.isPending ? "Opening…" : `Ask ${selected.length} selected`}
          </button>
        ) : (
          <span className="selection-guidance">Select ready documents to ask across them.</span>
        )}
      </div>
      {operationError ? (
        <div className="form-error" role="alert">
          {errorMessage(operationError)}
        </div>
      ) : null}
      <section className="document-table" aria-label="Documents">
        <div className="document-table-head" aria-hidden="true">
          <span>Document</span>
          <span>Status</span>
          <span>Pages</span>
          <span>Updated</span>
          <span />
        </div>
        {documents.isLoading ? (
          <div className="table-loading" role="status">
            <span className="spinner" /> Loading documents…
          </div>
        ) : documents.data?.length ? (
          documents.data.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              selected={selected.includes(document.id)}
              onSelect={() =>
                setSelected((current) =>
                  current.includes(document.id)
                    ? current.filter((id) => id !== document.id)
                    : [...current, document.id],
                )
              }
            />
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-index">00</span>
            <h2>{deferredQuery ? "No stored documents match" : "No documents yet"}</h2>
            <p>
              {deferredQuery
                ? "Change or clear the search term."
                : "Upload a PDF to begin. Processing runs in the background and reports its status here."}
            </p>
            {!deferredQuery ? (
              <button className="primary-button" onClick={() => setUploadOpen(true)}>
                Upload PDF
              </button>
            ) : null}
          </div>
        )}
      </section>
      {uploadOpen ? (
        <UploadDialog
          busy={upload.isPending}
          error={upload.error}
          inputRef={inputRef}
          onClose={() => setUploadOpen(false)}
          onChoose={(file) => upload.mutate(file)}
        />
      ) : null}
      {collectionOpen ? (
        <CollectionDialog
          name={collectionName}
          description={collectionDescription}
          documentCount={selected.length}
          busy={createCollection.isPending}
          error={createCollection.error}
          onNameChange={setCollectionName}
          onDescriptionChange={setCollectionDescription}
          onClose={() => setCollectionOpen(false)}
          onSubmit={() => createCollection.mutate()}
        />
      ) : null}
    </div>
  );
}
