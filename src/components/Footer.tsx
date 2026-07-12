import Link from 'next/link';

export default function Footer() {
  const projectName = process.env.NEXT_PUBLIC_PROJECT_NAME ?? 'ZeroOrigine';
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-gray-500">
          &copy; {year} {projectName}. All rights reserved.
        </p>
        <div className="flex gap-6">
          <Link
            href="/pricing"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Pricing
          </Link>
          <Link
            href="mailto:support@zeroorigine.com"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
