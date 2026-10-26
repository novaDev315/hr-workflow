import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import {
  CreateJobRequisitionInput,
  CreateRecruitmentApplicationInput,
} from "../recruitment/recruitment.types";
import {
  assertCompensationFitsMoneyLimit,
  calculatePayslip,
} from "../payroll/payroll-calculator";
import { UpsertEmployeeCompensationInput } from "../payroll/payroll.types";
import { MAX_MONEY } from "./money";

async function messages<T extends object>(cls: new () => T, plain: object) {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe("money input validation", () => {
  const base = { employeeId: "e1", baseSalary: 1000 };

  it("accepts the column maximum and ordinary values", async () => {
    expect(
      await messages(UpsertEmployeeCompensationInput, {
        ...base,
        baseSalary: MAX_MONEY,
      }),
    ).toEqual([]);
    expect(
      await messages(UpsertEmployeeCompensationInput, {
        ...base,
        allowanceAmount: 0.5,
      }),
    ).toEqual([]);
  });

  it("rejects amounts above the numeric(14,2) limit with a readable message", async () => {
    expect(
      await messages(UpsertEmployeeCompensationInput, {
        ...base,
        baseSalary: 1e12,
      }),
    ).toContain("baseSalary must not exceed 999,999,999,999.99");
    expect(
      await messages(UpsertEmployeeCompensationInput, {
        ...base,
        deductionAmount: 1e15,
      }),
    ).toContain("deductionAmount must not exceed 999,999,999,999.99");
  });

  it("rejects more than two decimal places", async () => {
    expect(
      await messages(UpsertEmployeeCompensationInput, {
        ...base,
        allowanceAmount: 10.125,
      }),
    ).toContain(
      "allowanceAmount must be a number with at most 2 decimal places",
    );
  });

  it("applies to recruitment salary fields", async () => {
    const requisition = {
      jobTitle: "Job",
      departmentId: "d1",
      description: "desc",
    };
    expect(
      await messages(CreateJobRequisitionInput, {
        ...requisition,
        salaryMin: 1e12,
      }),
    ).toContain("salaryMin must not exceed 999,999,999,999.99");
    expect(
      await messages(CreateJobRequisitionInput, {
        ...requisition,
        salaryMax: 1.234,
      }),
    ).toContain("salaryMax must be a number with at most 2 decimal places");
    expect(
      await messages(CreateRecruitmentApplicationInput, {
        requisitionId: "r1",
        firstName: "A",
        lastName: "B",
        email: "a@example.test",
        expectedSalary: 1e12,
      }),
    ).toContain("expectedSalary must not exceed 999,999,999,999.99");
  });
});

describe("computed payroll overflow guard", () => {
  const period = { startDate: "2026-10-01", endDate: "2026-10-31" };
  const employee = {
    employeeId: "e1",
    employeeNumber: "EMP001",
    employeeName: "Test Employee",
    joinDate: "2020-01-01",
    exitDate: null,
    baseSalary: MAX_MONEY,
    allowanceAmount: 0,
    deductionAmount: 0,
    currencyCode: "AED",
    approvedLeaves: [],
    unpaidLeaves: [],
    attendedDays: 0,
  };

  it("allows base plus allowance exactly at the limit", () => {
    expect(() =>
      calculatePayslip(period, {
        ...employee,
        baseSalary: 999_999_999_000,
        allowanceAmount: 999.99,
      }),
    ).not.toThrow();
  });

  it("rejects base plus allowance above the limit with a readable error", () => {
    expect(() =>
      calculatePayslip(period, {
        ...employee,
        baseSalary: 600_000_000_000,
        allowanceAmount: 600_000_000_000,
      }),
    ).toThrow(
      "Test Employee (EMP001): base salary plus allowance exceeds the maximum payable amount of 999999999999.99",
    );
  });

  it("rejects at compensation write time without an employee name", () => {
    expect(() =>
      assertCompensationFitsMoneyLimit({
        baseSalary: MAX_MONEY,
        allowanceAmount: 0.01,
      }),
    ).toThrow("base salary plus allowance exceeds the maximum payable amount");
  });
});
