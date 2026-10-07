import { POLICY_LAST_UPDATED, POLICY_LAST_UPDATED_ISO } from '@/lib/config';

export function PolicyHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      <p className="last-updated" data-testid="last-updated">
        Last updated: <time dateTime={POLICY_LAST_UPDATED_ISO}>{POLICY_LAST_UPDATED}</time>
      </p>
      <p>{intro}</p>
    </header>
  );
}

export function Toc({ items }: { items: [id: string, label: string][] }) {
  return (
    <nav className="card soft" aria-label="On this page">
      <h2 className="small muted" style={{ margin: 0 }}>
        On this page
      </h2>
      <ol className="toc">
        {items.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`}>{label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
