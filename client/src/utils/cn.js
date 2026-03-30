import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-friendly class merge (LocalKnowledge pattern). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
