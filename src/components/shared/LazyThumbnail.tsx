import React, { useEffect, useRef, useState } from "react";
import type { FolioItem, ThumbnailUrls } from "../../types";

interface QueuedThumbnailRequest {
  reject: (error: unknown) => void;
  resolve: (urls: ThumbnailUrls) => void;
}

const thumbnailQueue = new Map<string, QueuedThumbnailRequest[]>();
let thumbnailQueueTimer: ReturnType<typeof setTimeout> | null = null;

function flushThumbnailQueue() {
  const currentQueue = new Map(thumbnailQueue);
  const itemIds = Array.from(currentQueue.keys());
  thumbnailQueue.clear();
  thumbnailQueueTimer = null;

  if (!itemIds.length) return;

  window.folio
    .ensureThumbnails(itemIds)
    .then((urls) => {
      currentQueue.forEach((requests) => {
        requests.forEach((request) => request.resolve(urls));
      });
    })
    .catch((error) => {
      currentQueue.forEach((requests) => {
        requests.forEach((request) => request.reject(error));
      });
    });
}

function enqueueThumbnailRequest(itemId: string): Promise<ThumbnailUrls> {
  return new Promise((resolve, reject) => {
    const requests = thumbnailQueue.get(itemId) ?? [];
    requests.push({ reject, resolve });
    thumbnailQueue.set(itemId, requests);

    if (thumbnailQueueTimer === null) {
      thumbnailQueueTimer = setTimeout(flushThumbnailQueue, 16);
    }
  });
}

export function LazyThumbnail({
  item,
  thumbUrls,
  setThumbUrls,
  requestThumbnail = true,
}: {
  item: FolioItem;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  requestThumbnail?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

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
    if (!requestThumbnail || !visible || thumbUrls[item.id]) return undefined;

    let cancelled = false;
    enqueueThumbnailRequest(item.id)
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
  }, [item.id, requestThumbnail, setThumbUrls, thumbUrls, visible]);

  const src = thumbUrls[item.id];

  return (
    <span className="thumb-shell" ref={shellRef}>
      {src ? (
        <img
          loading="lazy"
          src={src}
          alt=""
          draggable={false}
        />
      ) : (
        <span className="thumb-placeholder">{item.missing ? "Missing" : "Preview"}</span>
      )}
    </span>
  );
}
