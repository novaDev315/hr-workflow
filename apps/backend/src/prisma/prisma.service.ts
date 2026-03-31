import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  async onModuleInit() {
    await this.pool.query('SELECT 1');
    await this.ensureSchema();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
    client?: PoolClient,
  ): Promise<QueryResult<T>> {
    return (client ?? this.pool).query<T>(text, values);
  }

  async one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
    client?: PoolClient,
  ): Promise<T | null> {
    const result = await this.query<T>(text, values, client);
    return result.rows[0] ?? null;
  }

  async many<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
    client?: PoolClient,
  ): Promise<T[]> {
    const result = await this.query<T>(text, values, client);
    return result.rows;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureSchema() {
    const statements = [
      `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          employee_id TEXT,
          password_hash TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          is_system BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS user_role_assignments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
          assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, role_id)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS company_settings (
          id TEXT PRIMARY KEY,
          singleton_key TEXT NOT NULL UNIQUE,
          company_name TEXT NOT NULL,
          legal_name TEXT,
          timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
          currency_code TEXT NOT NULL DEFAULT 'AED',
          country_code TEXT NOT NULL DEFAULT 'AE',
          support_email TEXT,
          support_phone TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          code TEXT NOT NULL UNIQUE,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS designations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE,
          department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
          level INTEGER NOT NULL DEFAULT 1,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(department_id, title)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS employees (
          id TEXT PRIMARY KEY,
          employee_number TEXT NOT NULL UNIQUE,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
          designation_id TEXT NOT NULL REFERENCES designations(id) ON DELETE RESTRICT,
          supervisor_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
          employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
          join_date DATE NOT NULL,
          exit_date DATE,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          geofence_radius INTEGER NOT NULL DEFAULT 100,
          address TEXT NOT NULL,
          city TEXT,
          state TEXT,
          country TEXT NOT NULL DEFAULT 'AE',
          postal_code TEXT,
          landmark TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS employee_location_assignments (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          release_date DATE,
          status TEXT NOT NULL DEFAULT 'ACTIVE'
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS attendance_records (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
          attendance_date DATE NOT NULL,
          clock_in_at TIMESTAMPTZ,
          clock_in_latitude DOUBLE PRECISION,
          clock_in_longitude DOUBLE PRECISION,
          clock_in_distance INTEGER,
          clock_in_photo_url TEXT,
          clock_in_notes TEXT,
          clock_in_geofence_valid BOOLEAN,
          clock_out_at TIMESTAMPTZ,
          clock_out_latitude DOUBLE PRECISION,
          clock_out_longitude DOUBLE PRECISION,
          clock_out_distance INTEGER,
          clock_out_photo_url TEXT,
          clock_out_notes TEXT,
          clock_out_geofence_valid BOOLEAN,
          total_minutes INTEGER,
          total_hours DOUBLE PRECISION,
          regular_hours DOUBLE PRECISION,
          overtime_hours DOUBLE PRECISION,
          status TEXT NOT NULL DEFAULT 'CLOCKED_IN',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(employee_id, attendance_date)
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS leave_types (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL UNIQUE,
          default_days DOUBLE PRECISION NOT NULL,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS leave_requests (
          id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          leave_type_id TEXT NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          total_days DOUBLE PRECISION NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          decided_at TIMESTAMPTZ,
          decided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          decision_notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id
        ON user_role_assignments(user_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_designations_department_id
        ON designations(department_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_employees_department_id
        ON employees(department_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_employees_designation_id
        ON employees(designation_id)
      `,
      `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS employee_id TEXT
      `,
      `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'users_employee_id_fkey'
          ) THEN
            ALTER TABLE users
            ADD CONSTRAINT users_employee_id_fkey
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id_unique
        ON users(employee_id)
        WHERE employee_id IS NOT NULL
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_employee_location_assignments_employee_id
        ON employee_location_assignments(employee_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_employee_location_assignments_location_id
        ON employee_location_assignments(location_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id
        ON attendance_records(employee_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_attendance_records_location_id
        ON attendance_records(location_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_attendance_records_attendance_date
        ON attendance_records(attendance_date)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id
        ON leave_requests(employee_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type_id
        ON leave_requests(leave_type_id)
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_leave_requests_status
        ON leave_requests(status)
      `,
      `
        INSERT INTO leave_types (id, code, name, default_days, description, is_active)
        VALUES
          ('seed-leave-casual', 'CASUAL', 'Casual Leave', 12, 'General personal leave allowance', TRUE),
          ('seed-leave-sick', 'SICK', 'Sick Leave', 12, 'Leave allowance for illness and recovery', TRUE),
          ('seed-leave-earned', 'EARNED', 'Earned Leave', 18, 'Accrued annual leave allowance', TRUE)
        ON CONFLICT (code) DO NOTHING
      `,
    ];

    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }
}
