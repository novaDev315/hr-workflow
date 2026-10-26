import { applyDecorators } from "@nestjs/common";
import { IsNumber, Max } from "class-validator";

/** Largest value a numeric(14,2) money column can hold. */
export const MAX_MONEY = 999_999_999_999.99;

const MONEY_LIMIT_TEXT = "999,999,999,999.99";

/** Validation for a money input: finite number, at most 2 decimals, within numeric(14,2). */
export function IsMoneyAmount() {
  return applyDecorators(
    IsNumber(
      { maxDecimalPlaces: 2 },
      {
        message: ({ property }) =>
          `${property} must be a number with at most 2 decimal places`,
      },
    ),
    Max(MAX_MONEY, {
      message: ({ property }) =>
        `${property} must not exceed ${MONEY_LIMIT_TEXT}`,
    }),
  );
}

export function moneyExceedsLimit(value: number) {
  return !Number.isFinite(value) || Math.abs(value) > MAX_MONEY;
}
