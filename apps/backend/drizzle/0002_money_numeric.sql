ALTER TABLE "employee_compensations"
	ALTER COLUMN "base_salary" SET DATA TYPE numeric(14, 2) USING round("base_salary"::numeric, 2),
	ALTER COLUMN "allowance_amount" SET DATA TYPE numeric(14, 2) USING round("allowance_amount"::numeric, 2),
	ALTER COLUMN "deduction_amount" SET DATA TYPE numeric(14, 2) USING round("deduction_amount"::numeric, 2);
--> statement-breakpoint
ALTER TABLE "job_requisitions"
	ALTER COLUMN "salary_min" SET DATA TYPE numeric(14, 2) USING round("salary_min"::numeric, 2),
	ALTER COLUMN "salary_max" SET DATA TYPE numeric(14, 2) USING round("salary_max"::numeric, 2);
--> statement-breakpoint
ALTER TABLE "payslips"
	ALTER COLUMN "base_salary" SET DATA TYPE numeric(14, 2) USING round("base_salary"::numeric, 2),
	ALTER COLUMN "prorated_base_salary" SET DATA TYPE numeric(14, 2) USING round("prorated_base_salary"::numeric, 2),
	ALTER COLUMN "allowance_amount" SET DATA TYPE numeric(14, 2) USING round("allowance_amount"::numeric, 2),
	ALTER COLUMN "deduction_amount" SET DATA TYPE numeric(14, 2) USING round("deduction_amount"::numeric, 2),
	ALTER COLUMN "attendance_deduction" SET DATA TYPE numeric(14, 2) USING round("attendance_deduction"::numeric, 2),
	ALTER COLUMN "gross_pay" SET DATA TYPE numeric(14, 2) USING round("gross_pay"::numeric, 2),
	ALTER COLUMN "net_pay" SET DATA TYPE numeric(14, 2) USING round("net_pay"::numeric, 2);
--> statement-breakpoint
ALTER TABLE "recruitment_applications"
	ALTER COLUMN "expected_salary" SET DATA TYPE numeric(14, 2) USING round("expected_salary"::numeric, 2);
