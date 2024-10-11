import Database from 'better-sqlite3';
export const db = new Database('database.db');
//db.pragma('journal_mode = WAL');
