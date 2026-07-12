import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/marketing/nav'

export const metadata: Metadata = {
  title: 'Privacy Policy — RigFile',
  description:
    'How RigFile collects, stores, and protects your driver-qualification-file data and account information.',
}

const LAST_UPDATED = 'February 12, 2025'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-orange-600">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-slate mt-10 max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-a:text-orange-600">
          <p>
            RigFile (&ldquo;RigFile,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides a
            DOT compliance calendar and audit-ready file generator for owner-operator and small-fleet
            truck operators. This Privacy Policy explains what information we collect, how we use it, and
            the choices you have. By creating an account or using RigFile, you agree to the practices
            described here.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We collect only the information needed to run your compliance file and your account:</p>
          <ul>
            <li>
              <strong>Account information.</strong> Your email address and authentication credentials,
              managed through our authentication provider. We never see or store your plaintext password.
            </li>
            <li>
              <strong>Driver-qualification data.</strong> The 18 DQF items you track &mdash; such as CDL
              details, medical examiner&rsquo;s certificate dates, MVR records, and their expiration
              dates &mdash; along with any driver profile information you enter.
            </li>
            <li>
              <strong>Uploaded documents.</strong> PDF or image files you upload as supporting evidence
              for a DQF item. These are stored in access-controlled object storage tied to your account.
            </li>
            <li>
              <strong>Billing information.</strong> Subscription status and plan tier. Card and payment
              details are handled entirely by our payment processor; we do not store full card numbers.
            </li>
            <li>
              <strong>Usage and technical data.</strong> Basic log data (such as timestamps and error
              reports) used to keep the service secure and reliable.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To track DQF item expiration dates and send you compliance reminders.</li>
            <li>To generate the audit-ready PDF files you request.</li>
            <li>To authenticate you and secure your account.</li>
            <li>To process subscriptions and manage entitlements.</li>
            <li>To diagnose problems, prevent abuse, and improve the service.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal information, and we do not use your
            driver-qualification data for advertising.
          </p>

          <h2>3. How Your Data Is Stored and Protected</h2>
          <p>
            Your data is stored in a managed database and object storage with row-level access controls
            so that each account can only access its own records. Data is encrypted in transit (HTTPS)
            and at rest by our infrastructure providers. Access to production systems is limited to
            authorized personnel.
          </p>

          <h2>4. Sharing and Disclosure</h2>
          <p>We share information only with service providers that help us operate RigFile, including:</p>
          <ul>
            <li>Our database, storage, and hosting providers.</li>
            <li>Our authentication provider.</li>
            <li>Our payment processor for subscription billing.</li>
          </ul>
          <p>
            These providers process data on our behalf under their own security and confidentiality
            obligations. We may also disclose information if required by law or to protect the rights,
            safety, and property of RigFile or our users. If you generate an audit file and choose to
            share it with the FMCSA, a DOT auditor, or any third party, that sharing is under your
            control.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain your account and compliance data for as long as your account is active. If you
            delete a DQF item, driver, or uploaded document, it is removed from your active records. If
            you close your account, we delete or anonymize your personal data within a reasonable period,
            except where we must retain limited records to comply with legal or billing obligations.
          </p>

          <h2>6. Your Choices and Rights</h2>
          <ul>
            <li>You can view and edit your DQF items, drivers, and profile at any time in the app.</li>
            <li>You can delete uploaded documents and records you no longer need.</li>
            <li>
              You can request a copy of your data or deletion of your account by contacting us at the
              email below.
            </li>
          </ul>

          <h2>7. Cookies</h2>
          <p>
            We use strictly necessary cookies to keep you signed in and maintain your session. We do not
            use third-party advertising or tracking cookies.
          </p>

          <h2>8. Children&rsquo;s Privacy</h2>
          <p>
            RigFile is a business tool intended for commercial drivers and operators. It is not directed
            to individuals under 18, and we do not knowingly collect data from children.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the
            &ldquo;Last updated&rdquo; date above. Material changes will be communicated through the app or
            by email.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            Questions about this policy or your data? Email us at{' '}
            <a href="mailto:privacy@rigfile.app">privacy@rigfile.app</a>.
          </p>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8">
          <Link
            href="/"
            className="text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            &larr; Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}
