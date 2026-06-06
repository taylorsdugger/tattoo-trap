import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tattoo Trap — find artists whose work matches your inspiration",
  description:
    "Upload a tattoo inspiration image and discover local artists whose work looks similar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-neutral-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Tattoo<span className="text-rose-500">Trap</span>
            </Link>
            <nav className="text-sm text-neutral-400">
              <Link href="/" className="hover:text-neutral-100">
                Search
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-neutral-600">
          Visual search powered by CLIP embeddings running in your browser. Instagram links go
          to the artists&apos; own pages.
        </footer>
      </body>
    </html>
  );
}
