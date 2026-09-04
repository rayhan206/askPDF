import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage, type Citation, type ConversationMessage } from "../api";
import { BrandLogo } from "../components/brand-logo";
import { useSession } from "../session";

const starters = [
  "Summarize the central argument",
  "What are the key findings?",
  "List the important definitions",
];

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [source, setSource] = useState<Citation | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const workspace = profile?.workspaces[0];
  const conversations = useQuery({
    queryKey: ["conversations", workspace?.id],
    queryFn: () => api.conversations(workspace?.id ?? ""),
    enabled: Boolean(workspace),
  });
  const documents = useQuery({
    queryKey: ["documents", workspace?.id],
    queryFn: () => api.documents(workspace?.id ?? ""),
    enabled: Boolean(workspace),
  });
  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api.conversation(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
  const ask = useMutation({
    mutationFn: (value: string) => api.ask(conversationId ?? "", value),
    onSuccess: async () => {
      setQuestion("");
      await queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("No workspace is available.");
      const ready = (documents.data ?? []).filter((item) => item.status === "ready");
      if (ready.length === 0)
        throw new Error("Upload and process a PDF before starting a conversation.");
      return api.createConversation(workspace.id, [ready[0]!.id]);
    },
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ["conversations", workspace?.id] });
      await navigate(`/ask/${item.id}`);
    },
  });
  useEffect(
    () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
    [conversation.data?.messages.length, ask.isPending],
  );
  const documentNames = useMemo(
    () => new Map((documents.data ?? []).map((document) => [document.id, document.displayName])),
    [documents.data],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (value && conversationId && !ask.isPending) ask.mutate(value);
  }

  async function openSource(citation: Citation) {
    setSource(citation);
    try {
      const verified = await api.citationSource(citation.id);
      window.open(verified.url, "_blank", "noopener,noreferrer");
    } catch {
      // The source drawer still gives the verified excerpt if the signed URL cannot be opened.
    }
  }

  return (
    <div className="chat-layout">
      <aside className="conversation-rail">
        <button
          className="new-chat-button"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          New conversation
        </button>
        <p className="rail-label">Recent conversations</p>
        <div className="conversation-list">
          {conversations.data?.map((item) => (
            <button
              className={item.id === conversationId ? "active" : ""}
              key={item.id}
              onClick={() => navigate(`/ask/${item.id}`)}
            >
              <span className="conversation-index" aria-hidden="true">
                §
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.selectedDocumentCount ?? 0} document
                  {item.selectedDocumentCount === 1 ? "" : "s"}
                </small>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <section className="conversation-pane">
        {!conversationId ? (
          <div className="chat-empty">
            <BrandLogo compact />
            <h1>Ask a ready document</h1>
            <p>
              Start a conversation from a ready PDF. Every factual answer is checked against
              page-level evidence before you see it.
            </p>
            <button
              className="primary-button"
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              Choose the first ready PDF <ArrowRight size={17} />
            </button>
            {create.error && <div className="form-error">{errorMessage(create.error)}</div>}
          </div>
        ) : conversation.isLoading ? (
          <div className="chat-loading">
            <span className="spinner" />
            Loading the cited conversation…
          </div>
        ) : conversation.error ? (
          <div className="chat-empty">
            <h2>Conversation unavailable</h2>
            <p>{errorMessage(conversation.error)}</p>
          </div>
        ) : (
          <>
            <header className="conversation-header">
              <div>
                <span className="section-label">Cited conversation</span>
                <h1>{conversation.data?.conversation.title}</h1>
              </div>
              <div className="document-chips">
                {conversation.data?.conversation.selectedDocumentIds?.map((id) => (
                  <span key={id}>{documentNames.get(id) ?? "Document"}</span>
                ))}
              </div>
            </header>
            <div className="message-stream">
              {(conversation.data?.messages ?? []).length === 0 && (
                <div className="starter-panel">
                  <span className="empty-index">01</span>
                  <h2>Ask your first question</h2>
                  <p>
                    Ask naturally. If the documents do not contain enough evidence, AskPDF will say
                    so.
                  </p>
                  <div>
                    {starters.map((item) => (
                      <button key={item} onClick={() => setQuestion(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {conversation.data?.messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  onCitation={(citation) => void openSource(citation)}
                />
              ))}
              {ask.isPending && (
                <div className="message assistant-message thinking">
                  <span className="assistant-orb" aria-hidden="true">
                    A
                  </span>
                  <div>
                    <p>Checking evidence across the selected pages…</p>
                    <div className="thinking-line" />
                  </div>
                </div>
              )}
              {ask.error && <div className="form-error">{errorMessage(ask.error)}</div>}
              <div ref={endRef} />
            </div>
            <form className="composer" onSubmit={submit}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={4000}
                placeholder="Ask a question about your selected PDFs…"
                rows={2}
              />
              <button disabled={!question.trim() || ask.isPending} aria-label="Send question">
                <Send size={18} />
              </button>
              <span>Enter to send · Shift + Enter for a new line</span>
            </form>
          </>
        )}
      </section>
      {source && (
        <aside className="source-drawer">
          <button className="modal-close" onClick={() => setSource(null)} aria-label="Close source">
            <X size={18} />
          </button>
          <span className="section-label">
            <BookOpen size={14} /> Verified source
          </span>
          <h2>{source.documentName ?? documentNames.get(source.documentId) ?? "Document"}</h2>
          <div className="page-chip">Page {source.pageNumber}</div>
          <blockquote>“{source.excerpt}”</blockquote>
          <button className="secondary-button" onClick={() => void openSource(source)}>
            Open PDF page <ArrowRight size={16} />
          </button>
          <p className="source-proof">
            This excerpt was matched against the stored chunk for processing version{" "}
            {source.processingVersion}.
          </p>
        </aside>
      )}
    </div>
  );
}

function Message({
  message,
  onCitation,
}: {
  message: ConversationMessage;
  onCitation: (citation: Citation) => void;
}) {
  if (message.role === "user")
    return (
      <div className="message user-message">
        <div>{message.content}</div>
      </div>
    );
  return (
    <div className="message assistant-message">
      <span className="assistant-orb" aria-hidden="true">
        A
      </span>
      <div className="answer-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {message.content}
        </ReactMarkdown>
        {message.insufficientEvidence && (
          <div className="abstention-note">
            The selected documents did not provide enough evidence for a reliable answer.
          </div>
        )}
        {message.citations.length > 0 && (
          <div className="citations">
            <p>Sources</p>
            {message.citations.map((citation) => (
              <button key={citation.id} onClick={() => onCitation(citation)}>
                <span>{citation.ordinal + 1}</span>
                <strong>{citation.documentName ?? "Document"}</strong>
                <small>Page {citation.pageNumber}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
