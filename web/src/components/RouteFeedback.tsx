import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

function routeLabel(pathname: string) {
  if (pathname === "/projects/overview") return "Workspace overview";
  if (pathname === "/projects") return "Workspace";
  if (pathname === "/help") return "Help and shortcuts";
  if (pathname === "/account") return "Google Drive connection";
  if (/^\/projects\/[^/]+\/editor$/.test(pathname)) return "Diagram editor";
  return "FLOX";
}

export function RouteFeedback() {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState("");
  const firstRender = useRef(true);

  useEffect(() => {
    const label = routeLabel(pathname);
    document.title = `${label} · FLOX`;

    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    setAnnouncement("");
    const frame = window.requestAnimationFrame(() => {
      setAnnouncement(`${label} loaded`);
      document.querySelector<HTMLElement>("#main-content")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>;
}
