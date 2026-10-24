// 간단한 인라인 SVG 아이콘 (stroke 기반)
type P = { className?: string };
const base = (d: React.ReactNode) =>
  function Icon({ className = "size-5" }: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        {d}
      </svg>
    );
  };

export const HomeIcon = base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>);
export const WalletIcon = base(<><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><circle cx="16" cy="15" r="1" /></>);
export const ListIcon = base(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>);
export const ChartIcon = base(<><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-6" /></>);
export const PlusIcon = base(<path d="M12 5v14M5 12h14" />);
export const LogoutIcon = base(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
export const TrashIcon = base(<><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></>);
export const EditIcon = base(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>);
export const CloseIcon = base(<path d="M18 6 6 18M6 6l12 12" />);
export const SunIcon = base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const MoonIcon = base(<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />);
export const MonitorIcon = base(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>);
export const RefreshIcon = base(<><path d="M20 11a8 8 0 0 0-14.9-3.9L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 14.9 3.9L21 15" /><path d="M21 20v-5h-5" /></>);
export const DownloadIcon = base(<><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>);
export const UploadIcon = base(<><path d="M12 20V9" /><path d="m7 14 5-5 5 5" /><path d="M5 4h14" /></>);
export const SettingsIcon = base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>);
export const InfoIcon = base(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>);
export const SearchIcon = base(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const CoinIcon = base(<><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-3 .9-3 2.2 0 3 5.8 1.6 5.8 4.4 0 1.3-1.3 2.4-3 2.4-1.3 0-2.4-.5-3-1.4M12 6.5V8m0 9.5V19" /></>);
export const SortIcon = base(<><path d="M7 4v16M3 16l4 4 4-4" /><path d="M14 6h7M14 12h5M14 18h3" /></>);
