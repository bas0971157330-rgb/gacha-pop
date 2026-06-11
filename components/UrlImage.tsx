"use client";

import { useEffect, useMemo, useState } from "react";

type UrlImageProps = {
  src?: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackSrc?: string;
};

const DEFAULT_IMAGE = "/hero-machine.png";

function normalizeImageSrc(src: string | null | undefined, fallbackSrc: string) {
  const trimmedSrc = typeof src === "string" ? src.trim() : "";
  if (!trimmedSrc) return fallbackSrc;
  if (trimmedSrc.startsWith("//")) return `https:${trimmedSrc}`;
  return trimmedSrc;
}

export function UrlImage({ src, alt, width, height, className, fallbackSrc = DEFAULT_IMAGE }: UrlImageProps) {
  const requestedSrc = useMemo(() => normalizeImageSrc(src, fallbackSrc), [fallbackSrc, src]);
  const [imageSrc, setImageSrc] = useState(requestedSrc);

  useEffect(() => {
    setImageSrc(requestedSrc);
  }, [requestedSrc]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={(event) => {
        if (imageSrc === fallbackSrc) return;
        setImageSrc(fallbackSrc);
      }}
    />
  );
}
