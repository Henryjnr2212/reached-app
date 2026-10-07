import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyHeader, Toc } from '@/components/PolicyHeader';
import { PRIVACY_EMAIL, PUBLISHER } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The rules for using Reached, including that it is not an emergency service.',
};

const SECTIONS: [string, string][] = [
  ['agreement', 'Agreeing to these terms'],
  ['not-emergency', 'Reached is not an emergency service'],
  ['delivery', 'Message delivery'],
  ['your-account', 'Your account'],
  ['acceptable-use', 'Acceptable use'],
  ['plans', 'Plans and payments'],
  ['liability', 'Our responsibility'],
  ['ending', 'Ending your account'],
  ['law', 'Ghana law'],
  ['contact', 'Contact'],
];

export default function TermsPage() {
  return (
    <div className="container narrow prose">
      <PolicyHeader
        title="Terms of Use"
        intro={`These terms are an agreement between you and ${PUBLISHER}, the makers of Reached. Please read them; they are short.`}
      />
      <div className="embed-hide">
        <Toc items={SECTIONS} />
      </div>

      <section aria-labelledby="agreement">
        <h2 id="agreement">Agreeing to these terms</h2>
        <p>
          By creating an account or using Reached you agree to these terms and to our{' '}
          <Link href="/privacy">Privacy Policy</Link>. You must be 16 or older, or be a teenager aged 13 to 15 whose
          parent or guardian set Reached up for you.
        </p>
      </section>

      <section aria-labelledby="not-emergency" className="card danger soft">
        <h2 id="not-emergency">Reached is not an emergency service</h2>
        <p>
          Reached helps you keep the people you trust informed. It does not replace the police, ambulance or fire
          service. <strong>Reached cannot call or message the police automatically</strong>, and phones do not let apps
          place emergency calls by themselves.
        </p>
        <p>
          If you are in danger, call <a href="tel:112">112</a> or the police on <a href="tel:191">191</a> yourself if you
          can.
        </p>
      </section>

      <section aria-labelledby="delivery">
        <h2 id="delivery">Message delivery</h2>
        <p>
          Arrival and alert messages depend on things outside our control: mobile networks, SMS and WhatsApp providers,
          your phone having battery, signal or data, and your phone&apos;s location and battery settings. Messages may be
          late or may not arrive. We show delivery status in Activity where networks report it, but we cannot promise
          every message will be delivered.
        </p>
        <p>
          Arrival detection uses your phone&apos;s location and can be wrong, for example in tall buildings or when the
          phone is in a vehicle. Check <Link href="/help">Help</Link> for tips that make it more reliable.
        </p>
      </section>

      <section aria-labelledby="your-account">
        <h2 id="your-account">Your account</h2>
        <ul>
          <li>Keep your phone and app PIN safe. You are responsible for what happens on your account.</li>
          <li>Give correct details for yourself and your contacts.</li>
          <li>Only add people who know you and agree to get messages about you.</li>
        </ul>
      </section>

      <section aria-labelledby="acceptable-use">
        <h2 id="acceptable-use">Acceptable use</h2>
        <p>Do not use Reached to:</p>
        <ul>
          <li>track, follow or watch anyone without their knowledge, or install it on someone else&apos;s phone;</li>
          <li>send false alerts or SOS messages on purpose, or prank your contacts or the police;</li>
          <li>harass people by adding them as contacts after they replied STOP;</li>
          <li>send spam, or try to break, overload or copy the service;</li>
          <li>break any law of Ghana.</li>
        </ul>
        <p>We may suspend accounts that break these rules, especially where someone&apos;s safety is at risk.</p>
      </section>

      <section aria-labelledby="plans">
        <h2 id="plans">Plans and payments</h2>
        <p>
          Reached has a free plan. Paid plans, if you choose one, are billed through mobile money or card. Prices and
          what each plan includes are shown in the app before you pay. You can cancel any time; it stops renewing at the
          end of the period you paid for.
        </p>
      </section>

      <section aria-labelledby="liability">
        <h2 id="liability">Our responsibility</h2>
        <p>
          We work hard to keep Reached reliable, but we provide it “as is”. As far as Ghanaian law allows, {PUBLISHER} is
          not responsible for loss or harm caused by messages that were late, not delivered, or sent by mistake, or by
          the app being unavailable. Nothing in these terms removes rights you have under Ghanaian consumer law.
        </p>
      </section>

      <section aria-labelledby="ending">
        <h2 id="ending">Ending your account</h2>
        <p>
          You can stop using Reached and <Link href="/delete-account">delete your account</Link> at any time. We may
          close accounts that break these terms. We may change these terms; we will tell you in the app before
          important changes take effect.
        </p>
      </section>

      <section aria-labelledby="law">
        <h2 id="law">Ghana law</h2>
        <p>
          These terms are governed by the laws of the Republic of Ghana, and the courts of Ghana deal with any dispute.
          Please contact us first; most problems can be sorted out quickly.
        </p>
      </section>

      <section aria-labelledby="contact" className="card soft">
        <h2 id="contact">Contact</h2>
        <p>
          {PUBLISHER}, Accra, Ghana. Email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </p>
      </section>
    </div>
  );
}
