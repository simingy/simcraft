import type { Metadata } from "next";
import Script from "next/script";
import SimTypeCards from "./components/SimTypeCards";
import SystemInfo from "./components/SystemInfo";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimHammer",
  description: "Run SimulationCraft simulations from your browser",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          id="wowhead-config"
          strategy="beforeInteractive"
        >{`const whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false };`}</Script>
        <Script
          src="https://wow.zamimg.com/js/tooltips.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-5 h-5 rounded bg-gold/90 flex items-center justify-center">
                <svg className="w-3 h-3 text-black" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 2l10 6-10 6V2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                SimHammer
              </span>
            </a>
            <div className="flex items-center gap-3">
              <SystemInfo />
              <a
                href="https://github.com/sortbek/simcraft/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-[13px] font-medium text-gold hover:text-white rounded-md transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 12V3M5 9l3 3 3-3M3 14h10" />
                </svg>
                Desktop App
              </a>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10">
          <SimTypeCards />
          {children}
        </main>
      </body>
    </html>
  );
}
