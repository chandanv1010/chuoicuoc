"use client";

import { Toaster as Sonner, toast } from "sonner";

/** Thong bao noi (thay toastr). */
export function Toaster() {
  return <Sonner position="top-right" richColors closeButton duration={4000} />;
}

export { toast };
