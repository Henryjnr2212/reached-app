import Link from 'next/link';
import { PUBLISHER } from '@/lib/config';
import { BrandMark } from './Icon';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <div className="bar">
          <Link href="/" className="brand" aria-label="Reached home">
            <BrandMark />
            <span>Reached</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            <Link href="/help">Help</Link>
            <Link href="/privacy">Privacy</Link>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-card">
          <p>
            <strong>Reached</strong> lets your people know you got there safely. Made in Ghana by {PUBLISHER}.
          </p>
          <nav aria-label="Footer">
            <ul className="footer-links">
              <li>
                <Link href="/help">Help and FAQ</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms">Terms of Use</Link>
              </li>
              <li>
                <Link href="/delete-account">Delete account</Link>
              </li>
            </ul>
          </nav>
          <p className="small">
            Reached is not an emergency service. In an emergency call <a href="tel:112">112</a> or the police on{' '}
            <a href="tel:191">191</a>.
          </p>
          <p className="small">© 2026 {PUBLISHER}</p>
        </div>
      </div>
    </footer>
  );
}
