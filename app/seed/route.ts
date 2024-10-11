import bcrypt from 'bcrypt';
// import { db } from '@vercel/postgres';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';
import { db } from '@/app/lib/db';

// const client = await db.connect();

async function seedUsers() {
  const result = db
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `,
    )
    .run();
  console.log('result = ', result);

  db.prepare('DELETE FROM users;').run();

  const insertedUsers = await users.map(async (user) => {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    db.prepare<{ name: string; email: string; password: string }>(
      `
        INSERT INTO users (name, email, password)
        VALUES ($name, $email, $password);
      `,
    ).run({ name: user.name, email: user.email, password: hashedPassword });
    return db
      .prepare<[], { name: string; email: string; password: string }>(
        `SELECT name, email, password FROM users WHERE rowid = last_insert_rowid()`,
      )
      .get();
  });

  return insertedUsers;
}

async function seedCustomers() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      image_url TEXT NOT NULL
    );
  `,
  ).run();

  db.prepare('DELETE FROM customers;').run();

  const insertedCustomers = customers.map((customer) =>
    db
      .prepare<{ name: string; email: string; image_url: string }, void>(
        `
        INSERT INTO customers (name, email, image_url)
        VALUES ($name, $email, $image_url);
      `,
      )
      .run({
        name: customer.name,
        email: customer.email,
        image_url: customer.image_url,
      }),
  );

  return insertedCustomers;
}

async function seedInvoices() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL
    );
  `,
  ).run();

  db.prepare('DELETE FROM invoices;').run();

  const insertedInvoices = invoices.map((invoice) => {
    db.prepare<
      { customer_email: string; amount: number; status: string; date: string },
      void
    >(
      `
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES ((SELECT id FROM customers WHERE email = $customer_email), $amount, $status, $date);
      `,
    ).run({
      customer_email: invoice.customer_email,
      amount: invoice.amount,
      status: invoice.status,
      date: invoice.date,
    });
    return db
      .prepare<
        [],
        { customer_id: number; amount: number; status: string; date: string }
      >(
        `select customer_id, amount, status, date from invoices where rowid = last_insert_rowid()`,
      )
      .get();
  });

  return insertedInvoices;
}

async function seedRevenue() {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS revenue (
      month TEXT NOT NULL UNIQUE,
      revenue INTEGER NOT NULL
    );
  `,
  ).run();

  db.prepare('DELETE FROM revenue;').run();

  const insertedRevenue = revenue.map((rev) => {
    db.prepare(
      `
        INSERT INTO revenue (month, revenue)
        VALUES ($month, $revenue);
      `,
    ).run({ month: rev.month, revenue: rev.revenue });
    return db
      .prepare<[], { month: string; revenue: number }>(
        `SELECT month, revenue FROM revenue WHERE rowid = last_insert_rowid()`,
      )
      .get();
  });

  return insertedRevenue;
}

export async function GET() {
  // return Response.json({
  //   message:
  //     'Uncomment this file and remove this line. You can delete this file when you are finished.',
  // });
  try {
    // db.transaction(async () => {
    const users = await seedUsers();
    console.log('users = ', users);
    await seedCustomers();
    await seedInvoices();
    await seedRevenue();
    // });
    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error(error);
    return Response.json({ error }, { status: 500 });
  }
}
