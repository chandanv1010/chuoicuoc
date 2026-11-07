"use client";

/** Thanh "Back to top" cua footer. */
export function BackToTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="block w-full bg-az-footer-top py-4 text-center text-[13px] hover:bg-[#485769]"
    >
      Back to top
    </button>
  );
}
