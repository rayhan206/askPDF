interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className="brand-logo" aria-label="AskPDF">
      <svg className="brand-symbol" viewBox="0 0 36 42" aria-hidden="true">
        <path className="brand-page" d="M4 1h19l9 9v31H4z" />
        <path className="brand-fold" d="M23 1v9h9" />
        <path
          className="brand-question"
          d="M12.2 16.4c.5-3.1 2.8-4.8 6.1-4.8 3.5 0 5.9 2 5.9 5.1 0 2.5-1.3 3.7-3.3 5.1-1.7 1.2-2.2 2.1-2.2 4"
        />
        <circle className="brand-question" cx="18.6" cy="31.3" r="1.5" />
        <path className="brand-citation" d="M26.5 20.5h6v11l-3-2.3-3 2.3z" />
      </svg>
      {compact ? null : (
        <span className="brand-wordmark">
          Ask<span>PDF</span>
        </span>
      )}
    </span>
  );
}
