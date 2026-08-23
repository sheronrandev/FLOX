import { useEffect, useState, type ReactNode } from "react";

export function UserAvatar({
  name,
  picture,
  className = "user-avatar",
  fallback,
}: {
  name: string;
  picture?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [picture]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "L";

  return (
    <span className={className} aria-hidden="true">
      {picture && !imageFailed
        ? <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        : (fallback ?? initials)}
    </span>
  );
}
