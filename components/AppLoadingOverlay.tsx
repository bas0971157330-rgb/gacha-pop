"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function AppLoadingOverlay() {
  const pathname = usePathname();
  const firstRenderRef = useRef(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const delay = firstRenderRef.current ? 1400 : 1000;
    firstRenderRef.current = false;
    const timer = window.setTimeout(() => setVisible(false), delay);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="app-loading-overlay" role="status" aria-live="polite">
      <span className="app-loading-shape app-loading-shape-left" />
      <span className="app-loading-shape app-loading-shape-right" />
      <span className="app-loading-star app-loading-star-one" />
      <span className="app-loading-star app-loading-star-two" />

      <div className="app-loading-content">
        <Image
          src="/navbar-logo.png"
          alt="Gacha Pop"
          width={260}
          height={260}
          className="app-loading-logo"
          priority
        />
        <div className="app-loading-text">
          <span>กำลังโหลด...</span>
        </div>
        <div className="app-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
