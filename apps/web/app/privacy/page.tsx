import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyHeader, Toc } from '@/components/PolicyHeader';
import { DPC_REGISTRATION_NUMBER, PRIVACY_EMAIL, PUBLISHER } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Reached collects, why, who it is shared with, how long it is kept and your rights under Ghana’s Data Protection Act, 2012 (Act 843).',
};

const SECTIONS: [string, string][] = [
  ['who-we-are', 'Who we are'],
  ['what-we-collect', 'What we collect'],
  ['why', 'Why we use it'],
  ['sharing', 'Who we share it with'],
  ['retention', 'How long we keep it'],
  ['contacts', 'Your contacts never need the app'],
  ['rights', 'Your rights under Act 843'],
  ['dpc', 'Data Protection Commission registration'],
  ['age', 'Minimum age'],
  ['security', 'How we keep it safe'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact us about your data'],
];

export default function PrivacyPage() {
  return (
    <div className="container narrow prose">
      <PolicyHeader
        title="Privacy Policy"
        intro="Reached tells the people you choose that you arrived safely, and alerts them if you need help. To do that we need a little of your data. This page explains, in plain words, what we collect, why, and what you can do about it."
      />
      <div className="embed-hide">
        <Toc items={SECTIONS} />
      </div>

      <section aria-labelledby="who-we-are">
        <h2 id="who-we-are">Who we are</h2>
        <p>
          Reached is made by {PUBLISHER} in Ghana. We are the data controller for the personal data described here. When
          this policy says “we” or “us”, it means {PUBLISHER}.
        </p>
      </section>

      <section aria-labelledby="what-we-collect">
        <h2 id="what-we-collect">What we collect</h2>
        <ul>
          <li>
            <strong>Your phone number</strong>, to sign you in with a one-time code and so your contacts know who the
            message is from.
          </li>
          <li>
            <strong>Your name</strong> (and a photo, if you add one), so messages say “Ama has arrived” rather than a
            number.
          </li>
          <li>
            <strong>Contacts you add</strong>: the name and phone number of each person you choose to tell. We only
            get the people you pick, never your whole address book.
          </li>
          <li>
            <strong>Your location, only when it is needed</strong>: near the places you save (to notice when you
            arrive), during a trip you start, and during an SOS. We do not track you all day.
          </li>
          <li>
            <strong>Device information</strong>: phone make and model, operating system version, app version, battery
            level during a trip, and a push notification token. This helps us fix problems and warn you when battery
            settings may stop arrivals.
          </li>
          <li>
            <strong>Message records</strong>: which messages were sent to which contact, and whether they were
            delivered, so you can see it in Activity.
          </li>
        </ul>
        <p>We do not collect your contacts list, messages, photos, or anything from other apps.</p>
      </section>

      <section aria-labelledby="why">
        <h2 id="why">Why we use it</h2>
        <ul>
          <li>To send arrival, “on the way”, overdue, SOS and all-clear messages to the people you chose.</li>
          <li>To check on you if you are late, and to alert your emergency contacts if you don&apos;t answer.</li>
          <li>To show a live location page to your contacts during a trip or an emergency.</li>
          <li>To keep your account secure and stop abuse (for example, people being added as contacts against their will).</li>
          <li>To fix bugs and make arrivals more reliable.</li>
        </ul>
        <p>
          We use your data because you asked us to provide the service (our agreement with you), and with your consent
          for location. We never sell your data and we do not use it for advertising.
        </p>
      </section>

      <section aria-labelledby="sharing">
        <h2 id="sharing">Who we share it with</h2>
        <p>Only the companies we need to run Reached, and only what each one needs:</p>
        <ul>
          <li>
            <strong>SMS and WhatsApp providers</strong>: Africa&apos;s Talking (SMS) and Meta (WhatsApp Business
            Platform) receive your contact&apos;s phone number and the text of the message so it can be delivered.
          </li>
          <li>
            <strong>Hosting</strong>: Supabase stores our database and runs our servers; Vercel hosts this website and
            the live location pages.
          </li>
          <li>
            <strong>Maps</strong>: Google Maps shows maps and looks up places inside the app. The live location page
            uses OpenStreetMap map tiles.
          </li>
          <li>
            <strong>Your contacts</strong>: the people you chose see what the messages and live location page show:
            your first name, phone number, location during a trip or emergency, battery level, and, in an emergency
            only, your trip details.
          </li>
          <li>
            <strong>Police</strong>: only if you switch on “Also alert the police” (when that feature is available),
            approved officers see your SOS alerts.
          </li>
          <li>
            <strong>The law</strong>: we share data with authorities only when Ghanaian law requires it.
          </li>
        </ul>
        <p>
          Some providers store data outside Ghana. When that happens we use providers that protect it to a standard
          at least as strong as Act 843 requires.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">How long we keep it</h2>
        <ul>
          <li>
            <strong>Location points from trips and SOS</strong> are deleted automatically after <strong>30 days</strong>.
          </li>
          <li>
            <strong>Activity</strong> (arrivals, alerts and message history) is kept for <strong>7 or 30 days</strong>,
            whichever you choose in Settings → Privacy and data. The default is 30 days. You can delete it any time.
          </li>
          <li>
            <strong>Live location links</strong> stop working when the trip ends, or 2 hours after an alert is cleared.
          </li>
          <li>
            <strong>Your account</strong> (phone number, name, places, contacts) is kept until you delete it. When you
            delete your account we remove it straight away; backups are overwritten within 30 days.
          </li>
        </ul>
      </section>

      <section aria-labelledby="contacts">
        <h2 id="contacts">Your contacts never need the app</h2>
        <p>
          The people you add get normal text messages. They never need to install Reached, create an account or share
          their own location. When you add someone, they get one message saying you added them, and they can reply
          STOP at any time to stop getting messages.
        </p>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">Your rights under Act 843</h2>
        <p>Under Ghana&apos;s Data Protection Act, 2012 (Act 843) you have the right to:</p>
        <ul>
          <li>know what personal data we hold about you and get a copy (in the app: Settings → Privacy and data → Download my data);</li>
          <li>have wrong data corrected;</li>
          <li>have your data deleted (Settings → Privacy and data → Delete account, or <Link href="/delete-account">on the web</Link>);</li>
          <li>object to us using your data, or withdraw consent (for example, turn off location access at any time);</li>
          <li>complain to the Data Protection Commission of Ghana if you are unhappy with how we handle your data.</li>
        </ul>
      </section>

      <section aria-labelledby="dpc">
        <h2 id="dpc">Data Protection Commission registration</h2>
        <p>
          {DPC_REGISTRATION_NUMBER === 'PENDING'
            ? `${PUBLISHER} has applied to register with the Data Protection Commission of Ghana as a data controller. We will show the number here as soon as it is issued.`
            : `${PUBLISHER} is registered with the Data Protection Commission of Ghana as a data controller.`}{' '}
          Registration number: <strong data-testid="dpc-number">{DPC_REGISTRATION_NUMBER}</strong>.
        </p>
      </section>

      <section aria-labelledby="age">
        <h2 id="age">Minimum age</h2>
        <p>
          You must be <strong>16 or older</strong> to use Reached. A parent or guardian may set Reached up for a teenager
          aged 13 to 15 on the teenager&apos;s own phone, and is responsible for that use.
          <span className="decision" title="Recorded as a product decision">Decision</span>
        </p>
        <p>Reached is not meant for children under 13. If you think a child under 13 is using it, contact us and we will delete the account.</p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">How we keep it safe</h2>
        <p>
          Data is encrypted when it travels and when it is stored. Every table is locked so each person can only see
          their own data. Staff access is limited and logged. Live links use long random codes and expire.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Changes to this policy</h2>
        <p>
          If we make important changes, we will tell you in the app before they take effect. The date at the top shows
          when this page last changed.
        </p>
      </section>

      <section aria-labelledby="contact" className="card soft">
        <h2 id="contact">Contact us about your data</h2>
        <p>
          Questions, requests or complaints about your data: email{' '}
          <a href={`mailto:${PRIVACY_EMAIL}`} data-testid="privacy-email">
            {PRIVACY_EMAIL}
          </a>
          . We reply within 7 days and complete requests within 30 days.
        </p>
        <p className="small muted">{PUBLISHER}, Accra, Ghana.</p>
      </section>
    </div>
  );
}
