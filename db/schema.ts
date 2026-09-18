import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),tokenHash:text('token_hash').notNull(),data:text('data').notNull(),version:integer('version').notNull().default(0)});

