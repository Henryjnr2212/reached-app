import Link from 'next/link';
import { Icon } from '@/components/Icon';

const STORE_LINKS = {
  play: process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#get-the-app',
  appStore: process.env.NEXT_PUBLIC_APP_STORE_URL || '#get-the-app',
};

export default function HomePage() {
  return (
    <div className="container">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <span className="eyebrow">Made for Ghana</span>
          <h1 id="hero-title">Let your people know you got there.</h1>
          <p className="lead">
            Reached sends a text to the people you choose when you arrive safely, and alerts them if you don&apos;t.
          </p>
          <div className="chips" aria-label="Highlights">
            <span className="chip green">
              <Icon name="message" size={16} /> Your people get a text, no app needed
            </span>
            <span className="chip">Works on MTN, Telecel and AT</span>
          </div>
          <div className="store-badges" id="get-the-app">
            <a className="store-badge" href={STORE_LINKS.play} aria-label="Get Reached on Google Play (coming soon)">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M4 3.5v17a1 1 0 0 0 1.5.86l14.7-8.5a1 1 0 0 0 0-1.72L5.5 2.64A1 1 0 0 0 4 3.5Z" />
              </svg>
              <span>
                <small>Coming soon to</small>
                <strong>Google Play</strong>
              </span>
            </a>
            <a className="store-badge" href={STORE_LINKS.appStore} aria-label="Get Reached on the App Store (coming soon)">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2-1.1 2.8-2.3.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-.9-2.5-3.6ZM14.1 5.6c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3Z" />
              </svg>
              <span>
                <small>Coming soon to</small>
                <strong>App Store</strong>
              </span>
            </a>
          </div>
        </div>

        <div className="phone-mock" aria-hidden="true">
          <div className="phone-screen">
            <svg viewBox="0 0 300 500" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
              <rect width="300" height="500" fill="var(--c-map-land)" />
              <path d="M-20 140 C 80 120, 160 220, 320 180" stroke="var(--c-map-water)" strokeWidth="38" fill="none" />
              <path d="M40 -10 L 90 520" stroke="var(--c-map-road)" strokeWidth="14" />
              <path d="M-10 300 L 310 260" stroke="var(--c-map-road)" strokeWidth="14" />
              <path d="M200 -10 L 240 520" stroke="var(--c-map-road)" strokeWidth="10" />
              <path d="M78 380 C 120 330, 170 300, 222 270" stroke="var(--c-primary)" strokeWidth="5" strokeDasharray="2 10" strokeLinecap="round" fill="none" />
              <circle cx="222" cy="270" r="26" fill="var(--c-primary)" opacity="0.18" />
              <circle cx="222" cy="270" r="10" fill="var(--c-primary)" stroke="var(--c-surface)" strokeWidth="4" />
            </svg>
            <div className="sos-dot">SOS</div>
            <div className="sms-bubble">
              <strong>REACHED</strong>
              <br />
              Ama has arrived safely at Work (8:42am). – Reached
            </div>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol className="points">
          <li>
            <span className="icon-square">
              <Icon name="pin" />
            </span>
            <div>
              <h3>Arrive, and they know</h3>
              <p>Save the places you go. When you reach one, Reached texts the people you picked. No need to remember.</p>
            </div>
          </li>
          <li>
            <span className="icon-square amber">
              <Icon name="clock" />
            </span>
            <div>
              <h3>Late? We check on you first</h3>
              <p>
                Start a trip with an expected time. If you don&apos;t arrive, we ask if you&apos;re okay. No answer, and
                your emergency contacts get your last location.
              </p>
            </div>
          </li>
          <li>
            <span className="icon-square red">
              <Icon name="shield" />
            </span>
            <div>
              <h3>SOS when it matters</h3>
              <p>Hold the SOS button and your emergency contacts get a live location link and your trip details.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="card info soft" aria-labelledby="noapp-title">
        <h2 id="noapp-title">Your people get a text, no app needed</h2>
        <p>
          Mum, your partner or your best friend just get a normal SMS. They never have to install anything, make an
          account or share their own location.
        </p>
        <Link href="/privacy" className="btn ghost">
          How we handle your data <Icon name="arrow" size={18} />
        </Link>
      </section>
    </div>
  );
}
