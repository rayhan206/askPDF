const configuredApiBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL =
  typeof configuredApiBaseUrl === "string" ? configuredApiBaseUrl : "http://localhost:4000/api/v1";

export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  displayName: string;
  status: "active" | "disabled";
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "viewer";
}

export interface SessionProfile {
  user: UserProfile;
  workspaces: WorkspaceSummary[];
}

export interface DocumentSummary {
  id: string;
  displayName: string;
  originalFilename: string;
  sizeBytes: number;
  pageCount: number | null;
  status: string;
  processingVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  id: string;
  documentId: string;
  documentName?: string;
  chunkId: string;
  processingVersion: number;
  pageNumber: number;
  excerpt: string;
  ordinal: number;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  status: string;
  content: string;
  insufficientEvidence: boolean;
  createdAt?: string;
  citations: Citation[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  selectedDocumentCount?: number;
  selectedDocumentIds?: string[];
  updatedAt?: string;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string;
  documentIds: string[];
  updatedAt?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

function csrfToken(): string {
  return sessionStorage.getItem("askpdf.csrf") ?? "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", csrfToken());
  let response = await fetchApi(path, { ...options, headers });
  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await fetchApi("/auth/refresh", {
      method: "POST",
    });
    if (refreshed.ok) {
      const refreshedPayload = (await refreshed.json()) as { data: { csrfToken: string } };
      persistCsrf(refreshedPayload.data.csrfToken);
      if (!["GET", "HEAD", "OPTIONS"].includes(method))
        headers.set("X-CSRF-Token", refreshedPayload.data.csrfToken);
      response = await fetchApi(path, { ...options, headers });
    }
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const envelope = payload as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(
      envelope?.error?.message ?? "The request could not be completed.",
      response.status,
      envelope?.error?.code ?? "UNKNOWN_ERROR",
    );
  }
  return (payload as { data: T }).data;
}

async function fetchApi(path: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
    });
  } catch (cause) {
    throw new ApiError(
      "AskPDF cannot reach its API. Check that the local services are running, then try again.",
      0,
      "API_UNAVAILABLE",
      { cause },
    );
  }
}

function persistCsrf(value: string): void {
  sessionStorage.setItem("askpdf.csrf", value);
}

export const api = {
  async register(input: {
    displayName: string;
    email?: string;
    phone?: string;
    password: string;
  }): Promise<SessionProfile> {
    const result = await request<{
      user: UserProfile;
      workspace: WorkspaceSummary;
      csrfToken: string;
    }>("/auth/register", { method: "POST", body: JSON.stringify(input) });
    persistCsrf(result.csrfToken);
    return { user: result.user, workspaces: [result.workspace] };
  },
  async login(identifier: string, password: string): Promise<SessionProfile> {
    const result = await request<SessionProfile & { csrfToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    persistCsrf(result.csrfToken);
    return { user: result.user, workspaces: result.workspaces };
  },
  async profile(): Promise<SessionProfile> {
    const result = await request<SessionProfile & { csrfToken: string }>("/auth/me");
    persistCsrf(result.csrfToken);
    return { user: result.user, workspaces: result.workspaces };
  },
  async logout(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
    sessionStorage.removeItem("askpdf.csrf");
  },
  async documents(workspaceId: string, query = ""): Promise<DocumentSummary[]> {
    const search = new URLSearchParams({ workspaceId });
    if (query) search.set("query", query);
    const result = await request<{ items: DocumentSummary[] }>(`/documents?${search.toString()}`);
    return result.items;
  },
  async upload(workspaceId: string, file: File): Promise<void> {
    const sha256 = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
    ]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const intent = await request<{
      uploadIntentId: string;
      upload: { url: string; headers: Record<string, string> };
    }>("/uploads/intents", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        filename: file.name,
        sizeBytes: file.size,
        sha256,
        contentType: "application/pdf",
      }),
    });
    let uploaded: Response;
    try {
      uploaded = await fetch(intent.upload.url, {
        method: "PUT",
        headers: intent.upload.headers,
        body: file,
      });
    } catch (cause) {
      throw new ApiError(
        "AskPDF cannot reach object storage. Check that the local services are running, then try again.",
        0,
        "STORAGE_UNAVAILABLE",
        { cause },
      );
    }
    if (!uploaded.ok)
      throw new ApiError(
        "Object storage rejected the upload.",
        uploaded.status,
        "STORAGE_UNAVAILABLE",
      );
    await request(`/uploads/${intent.uploadIntentId}/complete`, {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
  },
  async collections(workspaceId: string): Promise<CollectionSummary[]> {
    const result = await request<{ items: CollectionSummary[] }>(
      `/document-collections?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
    return result.items;
  },
  async createCollection(
    workspaceId: string,
    name: string,
    description: string,
    documentIds: string[],
  ): Promise<CollectionSummary> {
    const result = await request<{ collection: CollectionSummary }>("/document-collections", {
      method: "POST",
      body: JSON.stringify({ workspaceId, name, description, documentIds }),
    });
    return result.collection;
  },
  async conversations(workspaceId: string): Promise<ConversationSummary[]> {
    const result = await request<{ items: ConversationSummary[] }>(
      `/conversations?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
    return result.items;
  },
  async createConversation(
    workspaceId: string,
    documentIds: string[],
  ): Promise<ConversationSummary> {
    const result = await request<{ conversation: ConversationSummary }>("/conversations", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        title: "New cited conversation",
        selectedDocumentIds: documentIds,
        collectionId: null,
      }),
    });
    return result.conversation;
  },
  async conversation(
    conversationId: string,
  ): Promise<{ conversation: ConversationSummary; messages: ConversationMessage[] }> {
    const result = await request<{
      conversation: ConversationSummary;
      messages: { items: ConversationMessage[] };
    }>(`/conversations/${conversationId}`);
    return { conversation: result.conversation, messages: result.messages.items };
  },
  async ask(
    conversationId: string,
    question: string,
  ): Promise<{ questionMessage: ConversationMessage; answerMessage: ConversationMessage }> {
    return request(`/conversations/${conversationId}/questions`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: JSON.stringify({ question, clientRequestId: crypto.randomUUID() }),
    });
  },
  async viewDocument(documentId: string, page: number): Promise<string> {
    const result = await request<{ url: string }>(`/documents/${documentId}/view-url?page=${page}`);
    return result.url;
  },
  async citationSource(
    citationId: string,
  ): Promise<{ url: string; pageNumber: number; excerpt: string }> {
    return request(`/citations/${citationId}/source`);
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
