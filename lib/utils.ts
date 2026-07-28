import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTWD(n: number): string {
  return `NT$${n.toLocaleString("en-US")}`;
}

export function formatPhone(n: string): string {
  const digits = n.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return n;
}

export function formatDateZh(d: Date): string {
  const days = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const day = days[d.getDay()];
  return `${month}月${date}日 (${day})`;
}