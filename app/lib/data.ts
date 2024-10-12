import { db } from "@/app/lib/db";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";
import { off } from "process";

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const rows = db.prepare<[], Revenue>("SELECT * FROM revenue").all();

    // console.log('Data fetch completed after 3 seconds.');

    return rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    // const data = await sql<LatestInvoiceRaw>`
    //   SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   ORDER BY invoices.date DESC
    //   LIMIT 5`;
    const rows = db
      .prepare<[], LatestInvoiceRaw>(
        "SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id " +
          "FROM invoices " +
          "JOIN customers ON invoices.customer_id = customers.id " +
          "ORDER BY invoices.date DESC " +
          "LIMIT 5"
      )
      .all();

    const latestInvoices = rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = db
      .prepare<[], { count: number }>("SELECT COUNT(*) as count FROM invoices")
      .get();
    const customerCountPromise = db
      .prepare<[], { count: number }>("SELECT COUNT(*) as count FROM customers")
      .get();

    const invoiceStatusPromise = db
      .prepare<[], { paid: number; pending: number }>(
        `
        SELECT 
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid", 
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending" 
          FROM invoices
        `
      )
      .get();
    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = data[0]?.count ?? 0;
    const numberOfCustomers = data[1]?.count ?? 0;
    const totalPaidInvoices = formatCurrency(data[2]?.paid ?? 0);
    const totalPendingInvoices = formatCurrency(data[2]?.pending ?? 0);

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = db
      .prepare<
        { query: string; items_per_page: number; offset: number },
        InvoicesTable
      >(
        `
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        UPPER(customers.name) LIKE $query OR
        UPPER(customers.email) LIKE $query OR
        UPPER(invoices.amount) LIKE $query OR
        UPPER(invoices.date) LIKE $query OR
        UPPER(invoices.status) LIKE $query
      ORDER BY invoices.date DESC
      LIMIT $items_per_page OFFSET $offset
    `
      )
      .all({
        query: "%" + query.toUpperCase() + "%",
        items_per_page: ITEMS_PER_PAGE,
        offset: offset,
      });

    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const data = db
      .prepare<{ query: string }, { count: number }>(
        `SELECT COUNT(*) as count
         FROM invoices
         JOIN customers ON invoices.customer_id = customers.id
           WHERE
             UPPER(customers.name) LIKE $query OR
             UPPER(customers.email) LIKE $query OR
             UPPER(invoices.amount) LIKE $query OR
             UPPER(invoices.date) LIKE $query OR
             UPPER(invoices.status) LIKE $query;
         `
      )
      .get({ query: "%" + query.toUpperCase() + "%" });

    const totalPages = Math.ceil(Number(data?.count ?? 0) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = db
      .prepare<{ id: string }, InvoiceForm>(
        `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = $id;
    `
      )
      .all({ id: id });

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const data = db
      .prepare<[], CustomerField>(
        `
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `
      )
      .all();

    const customers = data;
    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = db
      .prepare<{ query: string }, CustomersTableType>(
        `
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  UPPER(customers.name) LIKE $query OR
        UPPER(customers.email) LIKE $query
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `
      )
      .all({ query: "%" + query.toUpperCase() + "%" });

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
