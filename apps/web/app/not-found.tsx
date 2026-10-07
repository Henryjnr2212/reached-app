import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container narrow">
      <div className="card" style={{ marginTop: 32 }}>
        <h1>Page not found</h1>
        <p className="muted">That page doesn&apos;t exist. It may have moved.</p>
        <Link href="/" className="btn">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
