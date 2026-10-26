const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconHome = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.5V20a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V9.5" />
    <path d="M9.5 20.5v-5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5" />
  </svg>
);

export const IconObserve = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const IconHistory = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="M8 6.5h12M8 12h12M8 17.5h12" />
    <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" strokeWidth={2.6} />
  </svg>
);

export const IconPatterns = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="M4 19.5V10M9.5 19.5V4.5M15 19.5v-8M20.5 19.5V8" />
  </svg>
);

export const IconReport = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="M6.5 3.5h7L19 8.5v11a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
    <path d="M13.5 3.5V9H19M9 13h6.5M9 16.5h4" />
  </svg>
);

export const IconSettings = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.8v2.2M12 18v2.2M3.8 12H6M18 12h2.2M6.2 6.2l1.5 1.5M16.3 16.3l1.5 1.5M17.8 6.2l-1.5 1.5M7.7 16.3l-1.5 1.5" />
  </svg>
);

export const IconAlert = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="M12 4.5 2.8 19.2a1 1 0 0 0 .87 1.5h16.66a1 1 0 0 0 .87-1.5L12 4.5Z" />
    <path d="M12 9.8v4.4" />
    <path d="M12 17.2h.01" strokeWidth={2.6} />
  </svg>
);

export const IconChevronRight = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const IconCheck = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </svg>
);

// ID-card shape — the pain passport carers keep with the child.
export const IconPassport = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 15.5c.6-1.3 1.7-2 3-2s2.4.7 3 2M14 10h3.5M14 13h3.5" />
  </svg>
);

export const IconPrint = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
    <path d="M7 8.5V3.5h10v5" />
    <rect x="3.5" y="8.5" width="17" height="8" rx="1.5" />
    <path d="M7 14h10v6.5H7z" />
  </svg>
);
