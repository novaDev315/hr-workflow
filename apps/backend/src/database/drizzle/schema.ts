import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

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
