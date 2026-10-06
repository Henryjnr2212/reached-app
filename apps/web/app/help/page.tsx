import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BATTERY_GUIDES } from '@reached/core';
import type { PhoneBrand } from '@reached/core';
import { Icon } from '@/components/Icon';
import { PRIVACY_EMAIL, SUPPORT_WHATSAPP, whatsappLink } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Help and FAQ',
  description: 'Answers to common questions about Reached, including why an arrival message did not send.',
};

const BRANDS: PhoneBrand[] = ['tecno', 'infinix', 'itel', 'samsung'];

function Faq({ id, q, children, open }: { id: string; q: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="faq" id={id} open={open}>
      <summary>{q}</summary>
      <div className="faq-body">{children}</div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <div className="container narrow">
      <header className="page-head">
        <h1>Help and FAQ</h1>
        <p>Quick answers to the questions people ask most. Still stuck? Chat with us on WhatsApp.</p>
      </header>

      <section aria-labelledby="support-title" className="card">
        <ul className="list">
          <li>
            <a
              className="row-link"
              href={whatsappLink(SUPPORT_WHATSAPP, 'Hi Reached support, I need help with')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="icon-square">
                <Icon name="whatsapp" />
              </span>
              <span className="grow">
                <span className="label" id="support-title">
                  Chat with support (WhatsApp)
                </span>
                <br />
                <span className="small muted">We usually reply within a few hours, 8am to 8pm.</span>
              </span>
              <Icon name="arrow" />
            </a>
          </li>
          <li>
            <a className="row-link" href={`mailto:${PRIVACY_EMAIL}`}>
              <span className="icon-square blue">
                <Icon name="lock" />
              </span>
              <span className="grow">
                <span className="label">Questions about your data</span>
                <br />
                <span className="small muted">{PRIVACY_EMAIL}</span>
              </span>
              <Icon name="arrow" />
            </a>
          </li>
        </ul>
      </section>

      <h2>Arrivals</h2>
      <Faq id="arrival-didnt-send" q="Why didn't my arrival send?" open>
        <p>Most missed arrivals come from one of these. Work down the list:</p>
        <ol>
          <li>
            <strong>Location isn&apos;t set to “All the time”.</strong> Reached can only notice you arriving if it may use
            location in the background. Open Settings → Permissions and battery in Reached and tap <em>Fix</em> next to
            Location, then choose <em>Allow all the time</em>.
          </li>
          <li>
            <strong>Battery saving closed Reached.</strong> Many phones stop apps in the background to save battery.
            In Reached go to Settings → Permissions and battery → Battery and follow the steps for your phone:
            <div className="grid" style={{ marginTop: 12 }}>
              {BRANDS.map((b) => {
                const g = BATTERY_GUIDES[b];
                return (
                  <div key={b} className="card soft" style={{ marginBottom: 0, padding: 16 }}>
                    <h3>{g.label}</h3>
                    <ol className="small">
                      {g.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </li>
          <li>
            <strong>The place zone is too small.</strong> Phone location can be off by 50 to 100 metres, more inside big
            buildings. Edit the place and make the circle bigger (150 m or more works well).
          </li>
          <li>
            <strong>You were still in a vehicle.</strong> Reached waits until you have stopped for a short time and are
            not in a moving car or trotro, so traffic near your destination doesn&apos;t count as arriving. It sends once
            you get out.
          </li>
          <li>
            <strong>Your contact replied STOP.</strong> If someone opted out, we skip them and show “Opted out” next to
            their name. Ask them to text START to the same number to get messages again.
          </li>
          <li>
            <strong>No mobile data.</strong> If you have no data when you arrive, Reached waits and sends when you are
            back online. After 5 minutes offline it opens your SMS app with the message ready, so you can send it as a
            normal text.
          </li>
        </ol>
        <p>
          Tip: Settings → Permissions and battery → <em>Run a test</em> sends a test message to you only, so you can
          check everything works.
        </p>
      </Faq>
      <Faq id="ask-first" q="Can I check the message before it goes?">
        <p>
          Yes. Settings → Arrivals → How arrivals are sent → <em>Ask me first</em>. You can choose to send anyway after
          5 or 10 minutes if you don&apos;t answer.
        </p>
      </Faq>

      <h2>Contacts and messages</h2>
      <Faq id="no-app" q="Do my contacts need the app?">
        <p>No. Your people get a normal text message. They don&apos;t install anything or make an account.</p>
      </Faq>
      <Faq id="what-they-see" q="What do my contacts see?">
        <p>
          A short SMS like “Ama has arrived safely at Work (8:42am). – Reached”. During a trip or emergency the message
          can include a live location link that stops working when the trip ends.
        </p>
      </Faq>

      <h2>Safety</h2>
      <Faq id="police" q="Does Reached call the police?">
        <p>
          No. Reached can&apos;t message the police automatically. It alerts your emergency contacts, and the SOS screen
          shows emergency numbers you can tap to call: <a href="tel:112">112</a>, police <a href="tel:191">191</a>.
        </p>
      </Faq>
      <Faq id="overdue" q="What happens if I'm late?">
        <p>
          We ask “Are you okay?” first. You can say you&apos;re fine, ask for more time, or get help. If you don&apos;t
          answer within 5 minutes, your emergency contacts get an alert with your last location.
        </p>
      </Faq>

      <h2>Your account</h2>
      <Faq id="delete" q="How do I delete my account?">
        <p>
          In the app: Settings → Privacy and data → Delete account. Or use the <Link href="/delete-account">web page</Link>.
        </p>
      </Faq>
      <Faq id="data" q="How long do you keep my location?">
        <p>
          Location points are deleted after 30 days, and activity after 7 or 30 days, whichever you choose. See the{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Faq>
    </div>
  );
}
