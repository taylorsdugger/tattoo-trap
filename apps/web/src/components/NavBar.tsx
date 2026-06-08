"use client";

import { useState } from "react";
import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/artists", label: "Artists" },
  { href: "/shops", label: "Shops" },
  { href: "/favorites", label: "Favorites" },
];

/* Top navigation. Horizontal on desktop; collapses into a hamburger-toggled
   panel on small screens so the mono links and account control don't scrunch. */
export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-5 font-mono text-[10.5px] font-medium uppercase tracking-label text-ink-faint sm:flex">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
        <AccountMenu />
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 flex-col items-center justify-center gap-[5px] text-ink sm:hidden"
      >
        <span
          className={`h-px w-5 bg-current transition-transform ${open ? "translate-y-[6px] rotate-45" : ""}`}
        />
        <span
          className={`h-px w-5 bg-current transition-opacity ${open ? "opacity-0" : ""}`}
        />
        <span
          className={`h-px w-5 bg-current transition-transform ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
        />
      </button>

      {/* Mobile dropdown panel */}
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-line bg-paper/95 backdrop-blur-sm sm:hidden">
          <nav className="flex flex-col gap-5 px-[clamp(28px,5vw,64px)] pb-8 pt-6 font-mono text-[12px] font-medium uppercase tracking-label text-ink-faint">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-1">
              <AccountMenu />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
