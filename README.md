# Centric System Limited

Centric System Limited is a web based inventory management and point of sale system for retail shops. It lets a shop track stock in real time, sell to customers at a counter, manage suppliers and purchase orders, and view profit, valuation and movement reports. Each shop is fully isolated, so many independent stores can use the same deployment without ever seeing one another's data.

Prices are shown in Ghana Cedis (GH₵).

## Table of contents

1. Overview
2. Key features
3. Roles and permissions
4. How accounts and shops work
5. Multi tenancy and data isolation
6. The point of sale flow
7. Stock accounting
8. Technology and tools
9. Project structure
10. Data model
11. Environment variables
12. Supabase setup
13. Running the project locally
14. Deployment
15. The demonstration store
16. Security notes

## 1. Overview

The application is a single page experience built with Next.js and React. All data is stored in a Supabase project (PostgreSQL with row level security, authentication and realtime). When Supabase is reachable the app reads and writes to the database; when it is not configured the app falls back to local sample data so the interface still renders.

Every signed in user belongs to a shop. The shop they belong to decides exactly which products, suppliers, sales, stock movements, purchase orders and team members they can see. A change made on one device appears on other devices in the same shop within a second through Supabase realtime.

## 2. Key features

* Real time inventory with low stock and out of stock alerts.
* Point of sale counter with product search, barcode scanning, cash, mobile money and card payments, cash tendered and change calculation, and a printable receipt.
* Automatic stock deduction on every sale and automatic stock increase when a purchase order is received.
* Suppliers directory and purchase orders (draft, receive, track).
* Reports and valuation: inventory value at cost and retail, potential margin, units on hand, low stock counts, and movement history.
* Accounting view for Managers and Sales Leaders.
* Three role based dashboards (Manager, Sales Leader, Sales Assistant).
* Staff approval workflow with instant notifications to the Manager and instant decline feedback to the worker.
* Responsive layout for desktop, tablet and mobile, including a slide in cart drawer and a dropdown navigation on small screens.
* Secure Manager sign up gated by an access code, email format validation, and optional email confirmation.

## 3. Roles and permissions

There are three roles. The label shown in the interface and the internal value used in the database are listed below.

| Interface label | Internal value | Who they are                                           |
| --------------- | -------------- | ------------------------------------------------------ |
| Manager         | `owner`        | The shop owner. Full control of one shop.              |
| Sales Leader    | `manager`      | Leads the sales team. Reports, purchasing, accounting. |
| Sales Assistant | `staff`        | Sells at the counter.                                  |

Permission summary:

* Manager: everything, including approving or declining staff, assigning roles, managing suppliers and purchasing, viewing cost, reports and accounting, and selling.
* Sales Leader: reports, valuation, purchasing, suppliers, accounting, cost visibility, and selling. Cannot approve staff or assign roles.
* Sales Assistant: selling at the counter and viewing their own dashboard.

Anyone who is signed in can sell at the counter.

## 4. How accounts and shops work

Accounts are created from the sign up screen. The person chooses a role.

* A **Manager** sets a shop name and the number of people working under them, and must enter the **Manager access code**. Creating a Manager account creates a new shop and makes that person its owner. The Manager account is active immediately.
* A **Sales Leader** or **Sales Assistant** types the name of the shop they work under. The app looks that shop up among the registered shops. The new account is created in a pending state and waits for the Manager to approve it. Until approval the worker sees a waiting screen.

When a worker signs up for a shop, that shop's Manager is notified on their dashboard (a banner and a bell with a count). The Manager approves or declines from the dashboard or the Team page. Approval opens the worker's dashboard instantly. A decline shows the worker a clear declined screen instantly, and the worker drops off the Manager's pending list.

The Manager access code is a single shared secret stored privately in the database. It is required to create any Manager account (the very first account on a brand new database is exempt so the system can be set up). This stops strangers from creating a Manager account and controlling a shop. The code value never ships to the browser; it is validated inside the database during sign up.

## 5. Multi tenancy and data isolation

Every shop is a separate tenant. Isolation is enforced in two layers:

1. **Database row level security.** Operational tables carry a `shop_id`. Policies restrict every read and write to the caller's own shop using a `my_shop_id()` helper. The people table is also shop scoped, so a Manager only ever receives the profiles that belong to their own shop, and only a Manager can approve, decline or change roles for their own shop's members.
2. **Application filtering.** The Team page and dashboard only display members whose shop matches the signed in Manager's shop.

Because isolation is enforced in the database, data from another store never reaches the browser in the first place.

Starter inventory is reserved for one demonstration shop only (see section 15). Every other shop, new or existing, starts with an empty catalogue and the Manager adds their own items.

## 6. The point of sale flow

The counter is opened from Sell / Counter. The cashier searches or scans a product, taps it to add it to the current sale, and adjusts quantities. They can enter an optional customer name, choose a payment method (cash, mobile money or card), apply a discount, and for cash enter the amount received so the system shows the change due. Completing the sale records the transaction, deducts stock, and shows a receipt that can be printed on a standard or thermal printer as a single clean page.

On tablet and mobile the current sale appears as a slide in drawer from the right, opened from a floating cart bar that shows the running item count and total.

## 7. Stock accounting

Stock is adjusted automatically and consistently:

* **Sale (subtraction).** Completing a sale reduces each item's stock by the quantity sold and records a sale movement with a negative quantity. A sale is blocked if there is not enough stock.
* **Receive purchase order (addition).** Receiving a purchase order increases each item's stock by the quantity received and records a receive movement.
* **Manual movements.** Stock can also be received, issued or adjusted directly, each of which writes a movement record.

Every change is written to the database and reflected across devices through realtime. The Stock Log lists all movements.

## 8. Technology and tools

**Framework and language**

* Next.js 16 (App Router, Turbopack) for the web application and routing.
* React 19 for the user interface.
* TypeScript for type safety across the codebase.

**Styling**

* Tailwind CSS v4 for utility styling.
* A small design token system defined in `globals.css` (CSS variables for colours, shadows and radius), with an emerald brand palette.

**Backend and data**

* Supabase for authentication, PostgreSQL storage, row level security and realtime.
* `@supabase/supabase-js` as the client library.

**Hardware and input**

* ZXing (`@zxing/browser` and `@zxing/library`) for camera based barcode scanning.

**Tooling**

* ESLint for linting.
* Vercel for hosting and continuous deployment from GitHub.

**State**

* A React context store (`src/store/Store.tsx`) holds all application state, talks to Supabase, and keeps a local fallback so the interface still works before the database is configured.

## 9. Project structure

```
centric-system-ltd/
  src/
    app/
      page.tsx              Role based dashboards
      counter/page.tsx      Point of sale counter and receipt
      inventory/page.tsx    Products list, add and edit, stock adjust
      movements/page.tsx    Stock log
      purchase-orders/      Purchase orders
      suppliers/            Suppliers directory
      reports/              Reports and valuation
      accounting/           Accounting (Manager and Sales Leader)
      team/page.tsx         Team, approvals and role assignment
      layout.tsx            App shell and metadata
      globals.css           Design tokens and base styles
    components/
      Shell.tsx             Auth gate and page frame
      Sidebar.tsx           Desktop navigation
      MobileNav.tsx         Mobile and tablet dropdown navigation
      Topbar.tsx            Header, alerts and account menu
      Login.tsx             Sign in and sign up
      AwaitingApproval.tsx  Pending and declined screens
      BarcodeScanner.tsx    Camera barcode scanner
      Select.tsx            Custom styled dropdown
      Brand.tsx             Logo and wordmark
      ItemImage.tsx         Product image with fallback
      Stat.tsx, Toaster.tsx Shared widgets
    lib/
      supabase.ts           Supabase client configuration
      inventory.ts          Types, roles, permissions, seed catalogue
      products.ts           Product catalogue data
      db.ts                 Shop aware data access layer and mappers
    store/
      Store.tsx             Application state and Supabase integration
  supabase-setup.sql        Profiles table and base policies
  supabase-roles.sql        Shops, approval columns and sign up trigger
  supabase-data.sql         Operational data tables and policies
  supabase-tenant.sql       Per shop scoping of operational data
  supabase-security.sql     Manager access code gate
  supabase-team-isolation.sql  Per shop scoping of the people table
  supabase-demo-cleanup.sql Reserve demo products for one shop
```

## 10. Data model

Main tables in the Supabase project:

* `profiles`: one row per user (id, email, full name, role, shop_id, approved, active).
* `shops`: one row per shop (id, name, owner_id, team_size).
* `products`: catalogue items (id, sku, name, brand, category, cost, price, stock, reorder level, reorder quantity, supplier, location, barcode, image, shop_id).
* `suppliers`: supplier directory (id, name, contact, phone, email, lead days, shop_id).
* `stock_movements`: every stock change (id, date, item, type, quantity, note, by name, shop_id).
* `purchase_orders`: orders to suppliers (id, supplier, dates, status, lines, note, shop_id).
* `sales`: completed sales (id, date, cashier, items, subtotal, discount, total, cost, profit, payment, customer, tendered, change, shop_id).
* `app_settings`: private settings, including the Manager access code.

Product and supplier identifiers are namespaced per shop when the starter catalogue is seeded, so each shop owns its own rows.

## 11. Environment variables

Create a file named `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
```

Optional:

```
NEXT_PUBLIC_SITE_URL=https://your-site-url
```

These variables are read at build time, so after changing them in a hosting provider you must trigger a new build.

## 12. Supabase setup

Run the SQL files in the Supabase SQL Editor in this order. Each file is safe to run again.

1. `supabase-setup.sql`: creates the profiles table and its base policies.
2. `supabase-roles.sql`: creates the shops table, adds shop and approval columns, installs the sign up trigger, and enables realtime for profiles.
3. `supabase-data.sql`: creates products, suppliers, stock movements, purchase orders and sales, with policies and realtime.
4. `supabase-tenant.sql`: adds shop scoping to every operational table and the `my_shop_id()` helper.
5. `supabase-security.sql`: adds the private Manager access code and gates Manager sign up behind it. Change the code value to your own secret before running.
6. `supabase-team-isolation.sql`: scopes the people table so a Manager only sees and manages their own shop's members.
7. `supabase-demo-cleanup.sql` (optional): keeps the starter catalogue only for the demonstration shop and empties every other shop.

To let new sign ups require a confirmed email, enable Confirm email under Authentication in the Supabase dashboard. The application already handles the resulting check your email step.

## 13. Running the project locally

Requirements: Node.js 20 or newer.

```
npm install
npm run dev
```

The app runs at the address printed in the terminal, usually `http://localhost:3000`. Build a production bundle with `npm run build` and run it with `npm run start`.

## 14. Deployment

The project is deployed on Vercel and builds automatically from the GitHub repository.

To make a deployment work:

1. Add the environment variables from section 11 in the hosting project settings for the Production environment.
2. Trigger a redeploy so the variables are included in the build.
3. Run the Supabase SQL files from section 12 on the connected project.

## 15. The demonstration store

The starter product catalogue is reserved for a single demonstration shop. It is loaded only when both of these are true:

* the shop is named `Centric Store`, and
* the owner's email is `profayensu77@gmail.com` (Dennis Ayensu Mensah).

Any other shop, including one that happens to also be named `Centric Store` but is owned by a different email, starts with an empty catalogue and the Manager adds their own products. The matching is not case sensitive and ignores surrounding spaces. The optional `supabase-demo-cleanup.sql` file enforces the same rule on data that already exists.

## 16. Security notes

* Manager accounts require the access code, enforced inside the database so it cannot be bypassed from the browser.
* Row level security isolates each shop's data and restricts approvals and role changes to that shop's Manager.
* Email format is validated before sign up, and email confirmation can be enabled in Supabase.
* The Supabase publishable key is public by design. The protection for data comes from the row level security policies and the Manager access gate, not from hiding the key.
