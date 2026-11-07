"use client";

import { useEffect } from "react";

/**
 * O trong cho editor portal vao; bao cho cua so cha khi da hydrate xong (React cua iframe se khong dung vao nua).
 * Dat ca co __builderReady vi editor co the chua kip nghe postMessage. Lop bb-editor: hien san cac khoi co
 * hieu ung xuat hien (editor khong chay IntersectionObserver).
 */
export function FrameSlot() {
  useEffect(() => {
    document.documentElement.classList.add("bb-editor");
    (window as Window & { __builderReady?: boolean }).__builderReady = true;
    if (window.parent !== window) window.parent.postMessage({ type: "builder-frame-ready" }, location.origin);
  }, []);
  return <div id="builder-root" />;
}
