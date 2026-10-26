CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"location_id" text NOT NULL,
	"attendance_date" date NOT NULL,
	"clock_in_at" timestamp with time zone,
	"clock_in_latitude" double precision,
	"clock_in_longitude" double precision,
	"clock_in_distance" integer,
	"clock_in_photo_url" text,
	"clock_in_notes" text,
	"clock_in_geofence_valid" boolean,
	"clock_out_at" timestamp with time zone,
	"clock_out_latitude" double precision,
	"clock_out_longitude" double precision,
	"clock_out_distance" integer,
	"clock_out_photo_url" text,
	"clock_out_notes" text,
	"clock_out_geofence_valid" boolean,
	"total_minutes" integer,
	"total_hours" double precision,
	"regular_hours" double precision,
	"overtime_hours" double precision,
	"status" text DEFAULT 'CLOCKED_IN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_records_employee_id_attendance_date_key" UNIQUE("employee_id","attendance_date")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"singleton_key" text NOT NULL,
	"company_name" text NOT NULL,
	"legal_name" text,
	"timezone" text DEFAULT 'Asia/Dubai' NOT NULL,
	"currency_code" text DEFAULT 'AED' NOT NULL,
	"country_code" text DEFAULT 'AE' NOT NULL,
	"support_email" text,
	"support_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_settings_singleton_key_unique" UNIQUE("singleton_key")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "designations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"code" text NOT NULL,
	"department_id" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "designations_code_unique" UNIQUE("code"),
	CONSTRAINT "designations_department_id_title_key" UNIQUE("department_id","title")
);
--> statement-breakpoint
CREATE TABLE "employee_compensations" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"base_salary" double precision NOT NULL,
	"allowance_amount" double precision DEFAULT 0 NOT NULL,
	"deduction_amount" double precision DEFAULT 0 NOT NULL,
	"currency_code" text DEFAULT 'AED' NOT NULL,
	"effective_from" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_compensations_employee_id_key" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "employee_location_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"location_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"release_date" date,
	"status" text DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_number" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"department_id" text NOT NULL,
	"designation_id" text NOT NULL,
	"supervisor_id" text,
	"employment_type" text DEFAULT 'FULL_TIME' NOT NULL,
	"join_date" date NOT NULL,
	"exit_date" date,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_number_unique" UNIQUE("employee_number"),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "job_requisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"requisition_number" text NOT NULL,
	"job_title" text NOT NULL,
	"department_id" text NOT NULL,
	"designation_id" text,
	"positions_count" integer DEFAULT 1 NOT NULL,
	"employment_type" text DEFAULT 'FULL_TIME' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"target_start_date" date,
	"salary_min" double precision,
	"salary_max" double precision,
	"currency_code" text DEFAULT 'AED' NOT NULL,
	"description" text NOT NULL,
	"requirements" text,
	"created_by_user_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_requisitions_requisition_number_unique" UNIQUE("requisition_number")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_days" double precision NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" text,
	"decision_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"default_days" double precision NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code"),
	CONSTRAINT "leave_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"geofence_radius" integer DEFAULT 100 NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"state" text,
	"country" text DEFAULT 'AE' NOT NULL,
	"postal_code" text,
	"landmark" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"period_month" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"processed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_periods_period_month_key" UNIQUE("period_month")
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" text PRIMARY KEY NOT NULL,
	"payroll_period_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"expected_workdays" integer NOT NULL,
	"attended_days" double precision DEFAULT 0 NOT NULL,
	"approved_leave_days" double precision DEFAULT 0 NOT NULL,
	"paid_days" double precision DEFAULT 0 NOT NULL,
	"unpaid_days" double precision DEFAULT 0 NOT NULL,
	"base_salary" double precision NOT NULL,
	"prorated_base_salary" double precision NOT NULL,
	"allowance_amount" double precision DEFAULT 0 NOT NULL,
	"deduction_amount" double precision DEFAULT 0 NOT NULL,
	"attendance_deduction" double precision DEFAULT 0 NOT NULL,
	"gross_pay" double precision NOT NULL,
	"net_pay" double precision NOT NULL,
	"currency_code" text DEFAULT 'AED' NOT NULL,
	"status" text DEFAULT 'GENERATED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_payroll_period_id_employee_id_key" UNIQUE("payroll_period_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "policy_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"version" text NOT NULL,
	"effective_date" date NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"document_url" text,
	"content" text,
	"published_at" timestamp with time zone,
	"document_original_name" text,
	"document_mime_type" text,
	"stored_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_documents_title_version_key" UNIQUE("title","version")
);
--> statement-breakpoint
CREATE TABLE "recruitment_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"application_number" text NOT NULL,
	"requisition_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"source" text,
	"years_experience" double precision,
	"expected_salary" double precision,
	"resume_url" text,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"notes" text,
	"decision_notes" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_action_by_user_id" text,
	"last_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recruitment_applications_application_number_unique" UNIQUE("application_number"),
	CONSTRAINT "recruitment_applications_requisition_id_email_key" UNIQUE("requisition_id","email")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key"),
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_assignments_user_id_role_id_key" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"employee_id" text,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designations" ADD CONSTRAINT "designations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_location_assignments" ADD CONSTRAINT "employee_location_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_location_assignments" ADD CONSTRAINT "employee_location_assignments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_supervisor_id_employees_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requisitions" ADD CONSTRAINT "job_requisitions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_requisition_id_job_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."job_requisitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_last_action_by_user_id_users_id_fk" FOREIGN KEY ("last_action_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attendance_records_employee_id" ON "attendance_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_records_location_id" ON "attendance_records" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_records_attendance_date" ON "attendance_records" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "idx_designations_department_id" ON "designations" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_employee_location_assignments_employee_id" ON "employee_location_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_location_assignments_location_id" ON "employee_location_assignments" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_employees_department_id" ON "employees" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_employees_designation_id" ON "employees" USING btree ("designation_id");--> statement-breakpoint
CREATE INDEX "idx_job_requisitions_status" ON "job_requisitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_job_requisitions_department_id" ON "job_requisitions" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_job_requisitions_created_at" ON "job_requisitions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_employee_id" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_leave_type_id" ON "leave_requests" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_status" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_periods_period_month" ON "payroll_periods" USING btree ("period_month");--> statement-breakpoint
CREATE INDEX "idx_payslips_employee_id" ON "payslips" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payslips_payroll_period_id" ON "payslips" USING btree ("payroll_period_id");--> statement-breakpoint
CREATE INDEX "idx_policy_documents_status" ON "policy_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recruitment_applications_requisition_id" ON "recruitment_applications" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "idx_recruitment_applications_status" ON "recruitment_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recruitment_applications_email" ON "recruitment_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_user_id" ON "user_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_employee_id_unique" ON "users" USING btree ("employee_id") WHERE "users"."employee_id" IS NOT NULL;