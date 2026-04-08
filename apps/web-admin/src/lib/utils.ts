import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  options: {
    currencyCode?: string;
    locale?: string;
    maximumFractionDigits?: number;
  } = {},
): string {
  const fractionDigits = options.maximumFractionDigits ?? 2;

  return new Intl.NumberFormat(options.locale ?? "en-AE", {
    style: "currency",
    currency: options.currencyCode ?? "AED",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  options: { locale?: string } = {},
): string {
  return new Intl.DateTimeFormat(options.locale ?? "en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(
  date: Date | string,
  options: { locale?: string } = {},
): string {
  return new Intl.DateTimeFormat(options.locale ?? "en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
