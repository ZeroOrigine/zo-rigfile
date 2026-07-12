import type { Metadata } from 'next'
import Link from 'next/link'
import MarketingNav from '@/components/marketing/nav'

export const metadata: Metadata = {
  title: 'Terms of Service — RigFile',
  description:
    'The terms governing your use of RigFile, the DOT compliance calendar and audit-ready file generator for owner-operator and small-fleet truck operators.',
}

const LAST_UPDATED = 'February 12, 2025'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-orange-600">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-slate mt-10 max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-a:text-orange-600">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of RigFile
            (&ldquo;RigFile,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a DOT
            compliance calendar and audit-ready file generator for owner-operator and small-fleet truck
            operators. By creating an account or using the service, you agree to these Terms. If you do
            not agree, do not use RigFile.
          </p>

          <h2>1. The Service</h2>
          <p>
            RigFile helps you track the 18 driver-qualification-file (DQF) items and their expiration
            dates, sends you compliance reminders, and generates audit-ready PDF files on demand.
            RigFile is a record-keeping and reminder tool &mdash; it does not perform, endorse, or
            replace an official DOT audit, and it does not provide legal advice.
          </p>

          <h2>2. Eligibility and Accounts</h2>
          <p>
            You must be at least 18 years old and able to form a binding contract to use RigFile. You are
            responsible for maintaining the confidentiality of your login credentials and for all
            activity that occurs under your account. Notify us promptly of any unauthorized use.
          </p>

          <h2>3. Your Responsibility for Compliance Data</h2>
          <p>
            You are solely responsible for the accuracy, completeness, and timeliness of the data you
            enter, including DQF item details, expiration dates, and uploaded documents. RigFile
            calculates statuses and reminders based on the information <strong>you</strong> provide. We
            do not verify your documents against government records and are not responsible for missed
            deadlines, fines, penalties, or violations resulting from incorrect, incomplete, or outdated
            data.
          </p>

          <h2>4. No Guarantee of Regulatory Outcome</h2>
          <p>
            While RigFile is designed to help you stay audit-ready, we do not guarantee that using the
            service will result in passing any DOT or FMCSA audit or avoiding any fine. Regulatory
            requirements change and are ultimately enforced by government agencies. You remain
            responsible for understanding and meeting the requirements that apply to you.
          </p>

          <h2>5. Subscriptions and Billing</h2>
          <ul>
            <li>
              RigFile offers free and paid subscription plans. Paid features are available only while
              your subscription is active.
            </li>
            <li>
              Paid plans renew automatically for the applicable billing period unless you cancel before
              the renewal date. Payments are processed by our third-party payment processor.
            </li>
            <li>
              You can cancel at any time from your billing settings. Cancellation stops future charges;
              access to paid features continues through the end of the current paid period.
            </li>
            <li>Fees are non-refundable except where required by law.</li>
          </ul>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Upload unlawful content or data you do not have the right to store.</li>
            <li>Attempt to access other users&rsquo; accounts or data.</li>
            <li>
              Interfere with, disrupt, or attempt to reverse engineer the service or its security
              controls.
            </li>
            <li>Use the service to violate any applicable law or regulation.</li>
          </ul>

          <h2>7. Your Content</h2>
          <p>
            You retain ownership of the data and documents you upload. You grant RigFile a limited
            license to store, process, and display that content solely to provide the service to you
            &mdash; for example, to render your compliance calendar and generate your audit files. Our
            handling of your data is described in our{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            RigFile, including its software, design, and branding, is owned by us and protected by
            intellectual-property laws. These Terms do not grant you any rights to our trademarks or
            proprietary materials beyond the right to use the service as intended.
          </p>

          <h2>9. Disclaimer of Warranties</h2>
          <p>
            RigFile is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of
            any kind, whether express or implied, including warranties of merchantability, fitness for a
            particular purpose, and non-infringement. We do not warrant that the service will be
            uninterrupted, error-free, or that reminders will always be delivered.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, RigFile and its providers will not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or for any DOT fines,
            penalties, lost revenue, or lost data arising from your use of or inability to use the
            service. Our total liability for any claim relating to the service will not exceed the amount
            you paid us for the service in the twelve months preceding the claim.
          </p>

          <h2>11. Termination</h2>
          <p>
            You may stop using RigFile and close your account at any time. We may suspend or terminate
            your access if you violate these Terms or if necessary to protect the service or other users.
            Upon termination, your right to use the service ends, though certain provisions (such as
            disclaimers and limitations of liability) survive.
          </p>

          <h2>12. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. When we do, we will revise the &ldquo;Last
            updated&rdquo; date above. Material changes will be communicated through the app or by email.
            Continued use of RigFile after changes take effect constitutes acceptance of the updated
            Terms.
          </p>

          <h2>13. Contact Us</h2>
          <p>
            Questions about these Terms? Email us at{' '}
            <a href="mailto:support@rigfile.app">support@rigfile.app</a>.
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
