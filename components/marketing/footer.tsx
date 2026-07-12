import Link from "next/link";

const productLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Log in" },
  { href: "/signup", label: "Start free" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export function Footer({ className }: { className?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className={`border-t border-slate-200 bg-white ${className ?? ""}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 sm:flex-row sm:justify-between">
        <div className="max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              R
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              RigFile
            </span>
          </Link>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            The DOT compliance calendar for owner-operators. Track all 18
            driver qualification file items, catch expirations before an
            auditor does, and generate an audit-ready PDF in one click.
          </p>
        </div>

        <div className="flex gap-16">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Product</h3>
            <ul className="mt-4 space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-slate-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
            <ul className="mt-4 space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-slate-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            &copy; {year} RigFile. All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            RigFile is a recordkeeping tool and is not affiliated with the
            FMCSA or U.S. DOT. Not legal advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

export const MarketingFooter = Footer;

export default Footer;
