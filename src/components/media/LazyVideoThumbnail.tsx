import { memo, useEffect, useRef, useState } from "react";

interface LazyVideoThumbnailProps {
  src: string;
  className?: string;
}

export const LazyVideoThumbnail = memo(function LazyVideoThumbnail({
  src,
  className,
}: LazyVideoThumbnailProps) {
  const elementRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "320px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={elementRef}
      src={shouldLoad ? src : undefined}
      className={className}
      preload={shouldLoad ? "metadata" : "none"}
      muted
      playsInline
      aria-hidden="true"
    />
  );
});
