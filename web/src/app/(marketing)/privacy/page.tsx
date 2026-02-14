import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Sweepy',
  description:
    'Learn how Sweepy handles your data. We only access email metadata and never read your full email body.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#0f0f23]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-[#9898b0]">
        Last updated: February 12, 2026
      </p>

      <div className="mt-10 space-y-10 text-base leading-7 text-[#64648a]">
        {/* Intro */}
        <section>
          <p>
            Sweepy (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates
            the sweepy.site website and the Sweepy Chrome extension. This
            Privacy Policy explains how we collect, use, and protect your
            information when you use our service.
          </p>
        </section>

        {/* What we collect */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            1. What Data We Collect
          </h2>
          <p className="mt-3">
            When you use Sweepy, we access the following <strong>email metadata only</strong>:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Sender name and email address</li>
            <li>Email subject line</li>
            <li>Date and time received</li>
            <li>Email headers (e.g., List-Unsubscribe)</li>
            <li>Message ID and thread ID</li>
          </ul>
          <p className="mt-3">
            <strong>
              We never read, store, or transmit the full body of your emails.
            </strong>{' '}
            Your email content stays between you and Gmail.
          </p>
          <p className="mt-3">
            We also collect basic account information when you sign in:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Google account email address</li>
            <li>Display name</li>
            <li>Profile picture (if available)</li>
          </ul>
        </section>

        {/* What we send to OpenAI */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            2. What We Send to OpenAI
          </h2>
          <p className="mt-3">
            To categorize your emails and generate cleanup suggestions, we send
            minimal metadata to OpenAI&apos;s API:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Sender name and email address</li>
            <li>Email subject line</li>
            <li>Date received</li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> send the full email body, attachments, or
            any personally identifiable content from within your emails. OpenAI
            does not use data sent through their API to train their models, as
            per their{' '}
            <a
              href="https://openai.com/policies/api-data-usage-policies"
              className="text-indigo-500 hover:text-indigo-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              API data usage policy
            </a>
            .
          </p>
        </section>

        {/* Data retention */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            3. Data Retention
          </h2>
          <p className="mt-3">
            Scan results (categorization data and suggestions) are stored for{' '}
            <strong>30 days</strong> after each scan, then automatically and
            permanently deleted.
          </p>
          <p className="mt-3">
            Your account information is retained as long as you maintain an
            active Sweepy account. If you delete your account, all associated
            data is removed within 30 days.
          </p>
        </section>

        {/* No selling */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            4. We Do Not Sell Your Data
          </h2>
          <p className="mt-3">
            We do not sell, rent, trade, or otherwise share your personal
            information or email metadata with third parties for marketing or
            advertising purposes. Your data is used solely to provide and
            improve the Sweepy service.
          </p>
        </section>

        {/* Security */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            5. Data Security
          </h2>
          <p className="mt-3">
            We use industry-standard security measures to protect your data,
            including:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Encryption in transit (TLS/HTTPS)</li>
            <li>Encrypted database storage</li>
            <li>Minimal data collection (metadata only)</li>
            <li>Regular security audits</li>
          </ul>
        </section>

        {/* GDPR */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            6. Your Rights (GDPR)
          </h2>
          <p className="mt-3">
            If you are located in the European Economic Area (EEA), you have the
            following rights under the GDPR:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              <strong>Right to access:</strong> Request a copy of the data we
              hold about you.
            </li>
            <li>
              <strong>Right to rectification:</strong> Request correction of
              inaccurate data.
            </li>
            <li>
              <strong>Right to erasure:</strong> Request deletion of your data
              (&quot;right to be forgotten&quot;).
            </li>
            <li>
              <strong>Right to data portability:</strong> Request an export of
              your data in a machine-readable format.
            </li>
            <li>
              <strong>Right to restrict processing:</strong> Request that we
              limit how we use your data.
            </li>
            <li>
              <strong>Right to object:</strong> Object to our processing of your
              data.
            </li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, please contact us at{' '}
            <a
              href="mailto:privacy@sweepy.site"
              className="text-indigo-500 hover:text-indigo-600 hover:underline"
            >
              privacy@sweepy.site
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        {/* Cookies */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">7. Cookies</h2>
          <p className="mt-3">
            We use essential cookies only — to manage your authentication
            session and remember your preferences. We do not use tracking
            cookies or third-party analytics cookies.
          </p>
        </section>

        {/* Children */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            8. Children&apos;s Privacy
          </h2>
          <p className="mt-3">
            Sweepy is not intended for children under 13 years of age. We do not
            knowingly collect personal information from children under 13.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">
            9. Changes to This Policy
          </h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify
            you of any material changes by posting the new policy on this page
            and updating the &quot;Last updated&quot; date.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-[#0f0f23]">10. Contact</h2>
          <p className="mt-3">
            If you have any questions about this Privacy Policy, please contact
            us at:
          </p>
          <p className="mt-3">
            <a
              href="mailto:privacy@sweepy.site"
              className="text-indigo-500 hover:text-indigo-600 hover:underline"
            >
              privacy@sweepy.site
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
