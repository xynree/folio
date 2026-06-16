import React, { useEffect, useRef, useState } from "react";
import type { FolioItem, ThumbnailUrls } from "../../types";
import { itemCanUseDirectPreview } from "../folio/model";

export function LazyThumbnail({
  item,
  thumbUrls,
  setThumbUrls,
}: {
  item: FolioItem;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [directSrc, setDirectSrc] = useState<string | null>(null);

  useEffect(() => {
    setDirectSrc(null);
  }, [item.id, item.path]);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "180px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || thumbUrls[item.id]) return undefined;

    let cancelled = false;
    window.folio
      .ensureThumbnails([item.id])
      .then((urls) => {
        if (cancelled) return;
        setThumbUrls((current) => ({ ...current, ...urls }));
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, setThumbUrls, thumbUrls, visible]);

  useEffect(() => {
    if (!visible || !itemCanUseDirectPreview(item)) return undefined;

    let cancelled = false;
    window.folio
      .getFileDataUrl(item.path)
      .then((url) => {
        if (!cancelled) setDirectSrc(url);
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [item.missing, item.path, item.type, visible]);

  const src = directSrc ?? thumbUrls[item.id];

  return (
    <span className="thumb-shell" ref={shellRef}>
      {src ? (
        <img
          loading="lazy"
          src={src}
          alt=""
          onError={() => {
            if (directSrc) setDirectSrc(null);
          }}
        />
      ) : (
        <span className="thumb-placeholder">{item.missing ? "Missing" : "Preview"}</span>
      )}
    </span>
  );
}
