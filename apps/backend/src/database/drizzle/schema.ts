import {
  AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  employeeId: text('employee_id'),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userRoleAssignments = pgTable(
  'user_role_assignments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('user_role_assignments_user_id_role_id_key').on(
      table.userId,
      table.roleId,
    ),
  ],
);

export const companySettings = pgTable('company_settings', {
  id: text('id').primaryKey(),
  singletonKey: text('singleton_key').notNull().unique(),
  companyName: text('company_name').notNull(),
  legalName: text('legal_name'),
  timezone: text('timezone').notNull().default('Asia/Dubai'),
  currencyCode: text('currency_code').notNull().default('AED'),
  countryCode: text('country_code').notNull().default('AE'),
  supportEmail: text('support_email'),
  supportPhone: text('support_phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const departments = pgTable('departments', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const designations = pgTable(
  'designations',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    code: text('code').notNull().unique(),
    departmentId: text('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    level: integer('level').notNull().default(1),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('designations_department_id_title_key').on(
      table.departmentId,
      table.title,
    ),
  ],
);

export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  employeeNumber: text('employee_number').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  departmentId: text('department_id')
    .notNull()
    .references(() => departments.id, { onDelete: 'restrict' }),
  designationId: text('designation_id')
    .notNull()
    .references(() => designations.id, { onDelete: 'restrict' }),
  supervisorId: text('supervisor_id').references(
    (): AnyPgColumn => employees.id,
    { onDelete: 'set null' },
  ),
  employmentType: text('employment_type').notNull().default('FULL_TIME'),
  joinDate: date('join_date').notNull(),
  exitDate: date('exit_date'),
  status: text('status').notNull().default('ACTIVE'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const locations = pgTable('locations', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  geofenceRadius: integer('geofence_radius').notNull().default(100),
  address: text('address').notNull(),
  city: text('city'),
  state: text('state'),
  country: text('country').notNull().default('AE'),
  postalCode: text('postal_code'),
  landmark: text('landmark'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const employeeLocationAssignments = pgTable(
  'employee_location_assignments',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    releaseDate: date('release_date'),
    status: text('status').notNull().default('ACTIVE'),
  },
);

export const leaveTypes = pgTable('leave_types', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull().unique(),
  defaultDays: doublePrecision('default_days').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leaveRequests = pgTable('leave_requests', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: text('leave_type_id')
    .notNull()
    .references(() => leaveTypes.id, { onDelete: 'restrict' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  totalDays: doublePrecision('total_days').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('PENDING'),
  requestedAt: timestamp('requested_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedByUserId: text('decided_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  decisionNotes: text('decision_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
