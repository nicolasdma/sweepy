import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Sweepy',
  description:
    'Terms and conditions for using the Sweepy email management service.',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Last updated: February 12, 2026
      </p>

      <div className="mt-10 space-y-10 text-base leading-7 text-gray-700">
        {/* Intro */}
        <section>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of the
            Sweepy website at sweepy.site and the Sweepy Chrome extension
            (collectively, the &quot;Service&quot;), operated by Sweepy
            (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By accessing or
            using the Service, you agree to be bound by these Terms.
          </p>
        </section>

        {/* Service description */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            1. Service Description
          </h2>
          <p className="mt-3">
            Sweepy is an AI-powered email management tool that works with Gmail.
            The Service scans your email metadata (sender, subject, date, and
            headers) to categorize emails and provide cleanup suggestions. Sweepy
            does not read, store, or transmit the full body of your emails.
          </p>
          <p className="mt-3">
            The Service requires a Google account and access to your Gmail via
            the Gmail API. By using Sweepy, you authorize us to access your
            email metadata as described in our{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            2. Account Registration
          </h2>
          <p className="mt-3">
            To use Sweepy, you must sign in with your Google account. You are
            responsible for maintaining the security of your account and for all
            activities that occur under your account. You agree to notify us
            immediately of any unauthorized use.
          </p>
        </section>

        {/* Free trial */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            3. Free Trial
          </h2>
          <p className="mt-3">
            New users receive a <strong>7-day free trial</strong> with full
            access to all features. No credit card is required to start the free
            trial.
          </p>
          <p className="mt-3">
            At the end of the free trial, your access to paid features will be
            suspended unless you subscribe to a paid plan. Any data from your
            trial scans will be retained according to our standard data
            retention policy (30 days from scan date).
          </p>
        </section>

        {/* Pricing and billing */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            4. Pricing and Billing
          </h2>
          <p className="mt-3">
            After the free trial, the Service is available for{' '}
            <strong>$5.00 per month</strong>. Billing occurs monthly through
            Stripe. All amounts are in USD.
          </p>
          <p className="mt-3">
            You may cancel your subscription at any time. Upon cancellation, you
            will retain access to paid features until the end of your current
            billing period. We do not offer refunds for partial billing periods.
          </p>
          <p className="mt-3">
            We reserve the right to change our pricing with 30 days&apos; notice
            via email. Price changes will apply at the start of your next
            billing cycle.
          </p>
        </section>

        {/* Acceptable use */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            5. Acceptable Use
          </h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              Use the Service for any unlawful purpose or in violation of any
              applicable laws
            </li>
            <li>
              Attempt to reverse-engineer, decompile, or disassemble the Service
            </li>
            <li>
              Use the Service to access, collect, or store data from other
              users&apos; email accounts
            </li>
            <li>
              Interfere with or disrupt the Service&apos;s infrastructure or
              other users&apos; access
            </li>
            <li>
              Use automated tools (bots, scrapers) to access the Service beyond
              its intended use
            </li>
            <li>
              Resell, sublicense, or redistribute the Service without our
              written consent
            </li>
          </ul>
        </section>

        {/* Intellectual property */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            6. Intellectual Property
          </h2>
          <p className="mt-3">
            The Service, including its design, code, features, and content, is
            owned by Sweepy and protected by intellectual property laws. You are
            granted a limited, non-exclusive, non-transferable license to use
            the Service for its intended purpose while your account is active.
          </p>
          <p className="mt-3">
            Your email data remains yours. We do not claim ownership of any data
            you provide or that we access through Gmail on your behalf.
          </p>
        </section>

        {/* Limitation of liability */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            7. Limitation of Liability
          </h2>
          <p className="mt-3">
            To the maximum extent permitted by law, Sweepy shall not be liable
            for any indirect, incidental, special, consequential, or punitive
            damages, including but not limited to:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Loss of data or emails</li>
            <li>Loss of profits or revenue</li>
            <li>Interruption of service</li>
            <li>
              Inaccurate email categorization or cleanup suggestions
            </li>
          </ul>
          <p className="mt-3">
            Our total liability for any claim arising from the Service shall not
            exceed the amount you have paid to Sweepy in the 12 months preceding
            the claim.
          </p>
          <p className="mt-3">
            The Service is provided on an &quot;as is&quot; and &quot;as
            available&quot; basis. We make no warranties, express or implied,
            regarding the reliability, accuracy, or availability of the Service.
          </p>
        </section>

        {/* Disclaimer */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            8. Disclaimer
          </h2>
          <p className="mt-3">
            Sweepy provides suggestions for email management. You are solely
            responsible for any actions you take based on those suggestions,
            including deleting, archiving, or unsubscribing from emails. We
            recommend reviewing all suggestions before applying them.
          </p>
        </section>

        {/* Termination */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            9. Termination
          </h2>
          <p className="mt-3">
            You may terminate your account at any time by contacting us at{' '}
            <a
              href="mailto:privacy@sweepy.site"
              className="text-blue-600 hover:underline"
            >
              privacy@sweepy.site
            </a>{' '}
            or through your account settings.
          </p>
          <p className="mt-3">
            We reserve the right to suspend or terminate your account if you
            violate these Terms, with or without notice. Upon termination:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Your access to the Service will be revoked immediately</li>
            <li>
              Any remaining subscription period will not be refunded unless
              required by law
            </li>
            <li>
              Your data will be deleted in accordance with our{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>
            </li>
          </ul>
        </section>

        {/* Modifications */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            10. Modifications to the Service
          </h2>
          <p className="mt-3">
            We reserve the right to modify, suspend, or discontinue any part of
            the Service at any time, with or without notice. We will make
            reasonable efforts to notify you of material changes.
          </p>
        </section>

        {/* Changes to terms */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            11. Changes to These Terms
          </h2>
          <p className="mt-3">
            We may update these Terms from time to time. We will notify you of
            material changes by posting the new Terms on this page and updating
            the &quot;Last updated&quot; date. Your continued use of the Service
            after the changes take effect constitutes your acceptance of the
            revised Terms.
          </p>
        </section>

        {/* Governing law */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">
            12. Governing Law
          </h2>
          <p className="mt-3">
            These Terms shall be governed by and construed in accordance with
            the laws of the jurisdiction in which Sweepy operates, without
            regard to conflict of law provisions.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900">13. Contact</h2>
          <p className="mt-3">
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="mt-3">
            <a
              href="mailto:privacy@sweepy.site"
              className="text-blue-600 hover:underline"
            >
              privacy@sweepy.site
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
