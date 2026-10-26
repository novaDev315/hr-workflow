import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  formatDateTime as formatDateTimeShared,
  formatDay,
  formatMoney,
} from "@/lib/format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated use formatMoney from "@/lib/format" */
export function formatCurrency(
  amount: number,
  options: {
    currencyCode?: string;
    locale?: string;
    maximumFractionDigits?: number;
  } = {},
): string {
  if (options.locale || options.maximumFractionDigits !== undefined) {
    const fractionDigits = options.maximumFractionDigits ?? 2;
    try {
      return new Intl.NumberFormat(options.locale ?? "en-AE", {
        style: "currency",
        currency: options.currencyCode ?? "AED",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(Number.isFinite(amount) ? amount : 0);
    } catch {
      return formatMoney(amount, options.currencyCode);
    }
  }

  return formatMoney(amount, options.currencyCode);
}

/** @deprecated use formatDay from "@/lib/format" */
export function formatDate(
  date: Date | string,
  _options: { locale?: string } = {},
): string {
  void _options;
  return formatDay(date);
}

/** @deprecated use formatDateTime from "@/lib/format" */
export function formatDateTime(
  date: Date | string,
  _options: { locale?: string } = {},
): string {
  void _options;
  return formatDateTimeShared(date);
}
