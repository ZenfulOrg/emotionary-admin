import Link from "next/link";
import { BookOpen, Mail } from "lucide-react";

export function AdminNavigation({
  current,
}: {
  current: "words" | "waitlist";
}) {
  return (
    <nav
      aria-label="Admin sections"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-7xl gap-6 px-4 sm:px-6 lg:px-8">
        {[
          { id: "words", href: "/", label: "Word library", Icon: BookOpen },
          {
            id: "waitlist",
            href: "/waitlist",
            label: "Book waitlist",
            Icon: Mail,
          },
        ].map(({ id, href, label, Icon }) => (
          <Link
            key={id}
            href={href}
            aria-current={current === id ? "page" : undefined}
            className={`inline-flex min-h-12 items-center gap-2 border-b-2 text-sm font-semibold ${current === id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-950"}`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
