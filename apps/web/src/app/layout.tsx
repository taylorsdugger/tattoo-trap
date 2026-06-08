import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Archivo, Newsreader, Spline_Sans_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import { AuthProvider } from "@/components/AuthProvider";
import Toaster from "@/components/Toaster";
import ScrollToTop from "@/components/ScrollToTop";
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
        <AuthProvider>
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-sm">
          <div className="relative flex items-center justify-between px-[clamp(28px,5vw,64px)] py-[18px]">
            <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap">
              <Image
                src="/brand-mark.png"
                alt=""
                width={240}
                height={240}
                priority
                unoptimized
                className="size-8"
              />
              <span className="font-display text-[17px] font-[420] italic tracking-display text-ink">
                Tattoo Trap
              </span>
            </Link>
            <NavBar />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1080px] flex-1 px-[clamp(28px,5vw,64px)]">
          {children}
        </main>
        <footer className="border-t border-line px-[clamp(28px,5vw,64px)] py-8 font-mono text-[11px] tracking-[0.03em] text-ink-faint">
          Visual search powered by CLIP embeddings running in your browser. Instagram links go to
          the artists&apos; own pages.
        </footer>
        <Toaster />
        <ScrollToTop />
        </AuthProvider>
      </body>
    </html>
  );
}
