import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Ghep className kieu shadcn/ui. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
