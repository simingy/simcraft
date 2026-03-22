export default function DesktopAppLink() {
  return (
    <a
      href="https://github.com/sortbek/simcraft/releases/latest"
      target="_blank"
      rel="noopener noreferrer"
      className="web-only px-3 py-1.5 text-sm font-medium text-gold hover:text-white rounded-md transition-colors flex items-center gap-1.5"
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12V3M5 9l3 3 3-3M3 14h10" />
      </svg>
      Desktop App
    </a>
  );
}
