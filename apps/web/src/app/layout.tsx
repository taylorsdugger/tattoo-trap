import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Newsreader, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const splineMono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-spline-mono" });

export const metadata: Metadata = {
  title: "Tattoo Trap — find artists whose work matches your inspiration",
  description:
    "Upload a tattoo inspiration image and discover local artists whose work looks similar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${archivo.variable} ${splineMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-sm">
          <div className="flex items-center justify-between px-[clamp(20px,5vw,64px)] py-[18px]">
            <Link href="/" className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="font-display text-[17px] font-[420] italic tracking-display text-ink">
                Tattoo Trap
              </span>
              <span className="size-[5px] -translate-y-0.5 rounded-full bg-accent" />
            </Link>
            <nav className="flex items-center gap-5 font-mono text-[10.5px] font-medium uppercase tracking-label text-ink-faint">
              <Link href="/" className="transition-colors hover:text-ink">
                Search
              </Link>
              <Link href="/artists" className="transition-colors hover:text-ink">
                Artists
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1080px] flex-1 px-[clamp(20px,5vw,64px)]">
          {children}
        </main>
        <footer className="border-t border-line px-[clamp(20px,5vw,64px)] py-8 font-mono text-[11px] tracking-[0.03em] text-ink-faint">
          Visual search powered by CLIP embeddings running in your browser. Instagram links go to
          the artists&apos; own pages.
        </footer>
      </body>
    </html>
  );
}
