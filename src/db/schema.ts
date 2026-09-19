import { pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('ADMIN'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const storeData = pgTable('store_data', {
  id: serial('id').primaryKey(),
  storeId: text('store_id').notNull().unique(),
  payload: jsonb('payload').notNull(),
  lastModified: timestamp('last_modified').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  storeId: text('store_id').notNull(),
  action: text('action').notNull(),
  details: text('details'),
  timestamp: timestamp('timestamp').defaultNow(),
});
