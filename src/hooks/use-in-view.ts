"use client";

import { useEffect, useRef, useState } from "react";

/** Returns true once the element intersects the viewport (for deferred fetches). */
export function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;

    const observer = new IntersectionObserver((entries, obs) => {
      if (entries[0]?.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, options?.root, options?.rootMargin, options?.threshold]);

  return { ref, inView };
}
