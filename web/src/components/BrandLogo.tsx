type BrandLogoVariant = "horizontal" | "mark" | "stacked";

interface BrandLogoProps {
  compact?: boolean;
  decorative?: boolean;
  variant?: BrandLogoVariant;
}

function FlowMark() {
  return (
    <svg className="flox-logo__mark" viewBox="0 0 44 44" aria-hidden="true">
      <rect className="flox-logo__ring" x="5" y="3" width="34" height="38" rx="14" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <path className="flox-logo__accent" d="m17.5 14 9 8-9 8" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export function BrandLogo({ compact = false, decorative = false, variant }: BrandLogoProps) {
  const resolvedVariant = variant ?? (compact ? "mark" : "horizontal");
  return (
    <span
      className={`flox-logo flox-logo--${resolvedVariant}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : "FLOX"}
    >
      {resolvedVariant === "mark" ? <FlowMark /> : <><span className="flox-logo__word">FL</span><FlowMark /><span className="flox-logo__word">X</span></>}
    </span>
  );
}
