import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';
import { PRIVACY_EMAIL, PUBLISHER } from '@/lib/config';
import { DeleteAccountFlow } from './DeleteAccountFlow';

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to delete your Reached account and data, in the app or on the web.',
};

function EmailFallback() {
  const subject = encodeURIComponent('Delete my Reached account');
  const body = encodeURIComponent('Please delete my Reached account. My phone number is: ');
  return (
    <div className="card" data-testid="delete-fallback">
      <h2>Can&apos;t use the app?</h2>
      <p>
        Online deletion isn&apos;t available right now. Email us from any address with the phone number on your
        account. We&apos;ll text that number to confirm it&apos;s you, then delete the account within 7 days.
      </p>
      <a className="btn" href={`mailto:${PRIVACY_EMAIL}?subject=${subject}&body=${body}`}>
        Email {PRIVACY_EMAIL}
      </a>
    </div>
  );
}

export default function DeleteAccountPage() {
  return (
    <div className="container narrow">
      <header className="page-head">
        <h1>Delete your Reached account</h1>
        <p>
          You can delete your account and data at any time, in the app or on this page. This page is provided by{' '}
          {PUBLISHER}, the developer of Reached.
        </p>
      </header>

      <section className="card" aria-labelledby="what-deleted">
        <h2 id="what-deleted">What gets deleted</h2>
        <ul className="list">
          <li>
            <span className="icon-square red">
              <Icon name="trash" />
            </span>
            <span className="grow">
              <span className="label">Straight away</span>
              <br />
              <span className="small muted">
                Your profile (name, photo, phone number), saved places and rules, contacts you added, trips, location
                points, activity and message history, live links, and app settings. Your contacts stop getting messages
                from you.
              </span>
            </span>
          </li>
          <li>
            <span className="icon-square amber">
              <Icon name="clock" />
            </span>
            <span className="grow">
              <span className="label">Within 30 days</span>
              <br />
              <span className="small muted">Copies in our encrypted backups are overwritten.</span>
            </span>
          </li>
          <li>
            <span className="icon-square blue">
              <Icon name="lock" />
            </span>
            <span className="grow">
              <span className="label">What we can&apos;t delete</span>
              <br />
              <span className="small muted">
                Text messages already delivered stay on your contacts&apos; phones. Payment receipts are kept as long as
                Ghana tax law requires, without your location or contacts.
              </span>
            </span>
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="in-app">
        <h2 id="in-app">Delete in the app</h2>
        <ol>
          <li>Open Reached and tap Settings.</li>
          <li>
            Go to <strong>Settings → Privacy and data → Delete account</strong>.
          </li>
          <li>Enter the code we text you to confirm.</li>
        </ol>
        <p className="small muted">
          Only want to clear your history? Use Settings → Privacy and data → Delete my activity now instead.
        </p>
      </section>

      <section aria-label="Delete on the web">
        <DeleteAccountFlow fallback={<EmailFallback />} />
      </section>
    </div>
  );
}
