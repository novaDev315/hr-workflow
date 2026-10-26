import { randomUUID } from 'crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { Client } from 'pg';

import { runMigrations } from '../scripts/migrate';

// src/__tests__ -> apps/backend/drizzle (DEFAULT_MIGRATIONS_FOLDER only resolves from dist).
const DEFAULT_MIGRATIONS_FOLDER = path.resolve(__dirname, '../../drizzle');

jest.setTimeout(120000);

const MONEY_COLUMNS: Array<[string, string]> = [
  ['employee_compensations', 'base_salary'],
  ['employee_compensations', 'allowance_amount'],
  ['employee_compensations', 'deduction_amount'],
  ['payslips', 'base_salary'],
  ['payslips', 'prorated_base_salary'],
  ['payslips', 'allowance_amount'],
  ['payslips', 'deduction_amount'],
  ['payslips', 'attendance_deduction'],
  ['payslips', 'gross_pay'],
  ['payslips', 'net_pay'],
  ['job_requisitions', 'salary_min'],
  ['job_requisitions', 'salary_max'],
  ['recruitment_applications', 'expected_salary'],
];

describe('0002_money_numeric migration on a scratch database', () => {
  const adminUrl = process.env.DATABASE_URL;
  const scratchName = `money_mig_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let admin: Client;
  let scratch: Client;
  let folder: string;

  beforeAll(async () => {
    if (!adminUrl) throw new Error('DATABASE_URL is required');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database "${scratchName}"`);
    const url = new URL(adminUrl);
    url.pathname = `/${scratchName}`;
    scratch = new Client({ connectionString: url.toString() });
    await scratch.connect();

    // Copy the migrations with the journal cut at 0001 (the pre-change head).
    folder = mkdtempSync(path.join(os.tmpdir(), 'money-mig-'));
    cpSync(DEFAULT_MIGRATIONS_FOLDER, folder, { recursive: true });
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
    journal.entries = journal.entries.slice(0, 2);
    writeFileSync(journalPath, JSON.stringify(journal));
  });

  afterAll(async () => {
    await scratch?.end();
    if (admin) {
      await admin.query(`drop database if exists "${scratchName}" with (force)`);
      await admin.end();
    }
    if (folder) rmSync(folder, { recursive: true, force: true });
  });

  const typeOf = async (table: string, column: string) =>
    (
      await scratch.query(
        `select data_type, numeric_precision, numeric_scale from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = $2`,
        [table, column],
      )
    ).rows[0];

  it('converts float money to exact numeric(14,2), rounding existing rows', async () => {
    await runMigrations(scratch, folder, () => undefined);
    for (const [table, column] of MONEY_COLUMNS) {
      expect((await typeOf(table, column)).data_type).toBe('double precision');
    }

    await scratch.query(`insert into departments (id, name, code) values ('d1', 'Dept', 'D1')`);
    await scratch.query(
      `insert into designations (id, title, code, department_id) values ('g1', 'Title', 'G1', 'd1')`,
    );
    await scratch.query(
      `insert into employees (id, employee_number, first_name, last_name, email, department_id, designation_id, join_date)
       values ('e1', 'E1', 'A', 'B', 'e1@example.test', 'd1', 'g1', '2030-01-01')`,
    );
    await scratch.query(
      `insert into employee_compensations (id, employee_id, base_salary, allowance_amount, deduction_amount, effective_from)
       values ('c1', 'e1', 1234.565, 0.1 + 0.2, 1e-9, '2030-01-01')`,
    );
    await scratch.query(
      `insert into payroll_periods (id, period_month, start_date, end_date) values ('p1', '2030-01', '2030-01-01', '2030-01-31')`,
    );
    await scratch.query(
      `insert into payslips (id, payroll_period_id, employee_id, expected_workdays, base_salary, prorated_base_salary,
         allowance_amount, deduction_amount, attendance_deduction, gross_pay, net_pay)
       values ('s1', 'p1', 'e1', 22, 1234.565, 1000.005, 0.1 + 0.2, 10.994, 0, 123456789012.345, 99999999.999)`,
    );
    await scratch.query(
      `insert into job_requisitions (id, requisition_number, job_title, department_id, description, salary_min, salary_max)
       values ('r1', 'R1', 'Job', 'd1', 'desc', 1500.5, 2500.125)`,
    );
    await scratch.query(
      `insert into recruitment_applications (id, application_number, requisition_id, first_name, last_name, email, expected_salary)
       values ('a1', 'A1', 'r1', 'A', 'B', 'a1@example.test', 3000.1)`,
    );

    // Apply the real head (all migrations, including 0002) to the populated database.
    const result = await runMigrations(scratch, DEFAULT_MIGRATIONS_FOLDER, () => undefined);
    expect(result.applied).toBe(1);

    for (const [table, column] of MONEY_COLUMNS) {
      expect(await typeOf(table, column)).toMatchObject({
        data_type: 'numeric',
        numeric_precision: 14,
        numeric_scale: 2,
      });
    }

    const text = async (sql: string) => (await scratch.query(sql)).rows[0];
    expect(
      await text(
        `select base_salary::text b, allowance_amount::text a, deduction_amount::text d from employee_compensations`,
      ),
    ).toEqual({ b: '1234.57', a: '0.30', d: '0.00' });
    expect(
      await text(
        `select base_salary::text b, prorated_base_salary::text p, allowance_amount::text a, deduction_amount::text d,
                gross_pay::text g, net_pay::text n from payslips`,
      ),
    ).toEqual({
      b: '1234.57',
      p: '1000.01',
      a: '0.30',
      d: '10.99',
      g: '123456789012.35',
      n: '100000000.00',
    });
    expect(
      await text(`select salary_min::text lo, salary_max::text hi from job_requisitions`),
    ).toEqual({ lo: '1500.50', hi: '2500.13' });
    expect(await text(`select expected_salary::text e from recruitment_applications`)).toEqual({
      e: '3000.10',
    });
  });
});
