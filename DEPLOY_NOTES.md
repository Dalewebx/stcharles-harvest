# Harvest of Unstoppable Blessings — Deployment Guide
### St. Charles Catholic Church, Owhase

## What's in this zip

```
index.html              ← the public page — anyone with the link sees this
admin.html               ← the Fin Sec / Chairman / Secretary input page
api/
  verify-pin.js          ← returning-user login
  check-username.js      ← step 1 of login — checks if this is a first-timer
  claim-account.js       ← first-time PIN setup
  add-entry.js           ← records income/expense
  add-pledge.js          ← records a new pledge
  fulfill-pledge.js      ← marks a pledge paid, creates the real entry
  _lib/auth.js           ← shared helper, not a page — just logic the others use
```

## Step 1 — Run this SQL in Supabase (SQL Editor → New Query)

```sql
create table admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  role text not null,
  pin_hash text,
  created_at timestamptz default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  type text not null check (type in ('income','expense')),
  category text not null,
  name text,
  amount numeric not null check (amount > 0),
  payment_method text,
  note text,
  created_by_name text not null,
  created_at timestamptz default now()
);

create table pledges (
  id uuid primary key default gen_random_uuid(),
  pledge_date date not null default current_date,
  category text not null,
  name text not null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','fulfilled')),
  fulfilled_entry_id uuid references entries(id),
  fulfilled_at timestamptz,
  created_by_name text not null,
  created_at timestamptz default now()
);

alter table admins enable row level security;
alter table entries enable row level security;
alter table pledges enable row level security;

create policy "public can read entries" on entries for select using (true);
create policy "public can read pledges" on pledges for select using (true);
-- No policies on admins = zero access via the public key, from anywhere.
-- No write policies on entries/pledges = the public key can never write —
-- only the server-side functions (using the service_role key) can.

insert into admins (username, name, role) values
  ('HarvestChairman', 'Mr. Sunday Biachi', 'Chairman'),
  ('HarvestSecretary', 'Mr. Africa Francis', 'Secretary'),
  ('HarvestSecretary2', 'Mr. Jude Oyibu', 'Secretary 2');
```

## Step 2 — Create a new GitHub repo and Vercel project

1. New GitHub repo (e.g. `stcharles-harvest`), push all the files from this zip
2. Go to vercel.com → New Project → import that repo → deploy

## Step 3 — Set 3 environment variables on Vercel

Settings → Environment Variables:

```
SUPABASE_URL          = https://ylfrayqilqflchngyzsu.supabase.co
SUPABASE_SERVICE_KEY   = (from Supabase → Settings → API → service_role key — NOT the anon key)
HARVEST_PIN_SALT       = 963f08be2bc7174151b1e8d94d66cda2f899f53f742c553f
```

**Important:** `SUPABASE_SERVICE_KEY` is the powerful key that can bypass all
security rules — it must only ever live here, as a Vercel environment
variable. Never put it in any HTML file or share it anywhere else.

After adding these, trigger a redeploy (push any small change, or hit
"Redeploy" in Vercel) so the functions actually pick them up.

## Step 4 — Share the two links

- **Public page** (share with everyone): `https://your-project.vercel.app/`
- **Admin page** (share only with the 3 committee members): `https://your-project.vercel.app/admin.html`

## How the login actually works

1. Each person opens the admin page and types their **username** (`HarvestChairman`, `HarvestSecretary`, or `HarvestSecretary2`)
2. **First time only:** the app recognizes they haven't set a PIN yet and asks them to choose one (typed twice, to confirm)
3. **Every time after that:** it just asks for their PIN
4. Every entry they save is automatically tagged with their real name — so the public ledger and the "Recent" tab always show who recorded what

## How pledges work

1. Log a pledge with a name, category, and amount — it shows up on the public page under "Pledges" as **pending**
2. When that person actually pays, go to the **Pledges** tab in admin, tap **Mark Paid**, confirm the amount and payment method
3. This automatically creates the real income entry AND updates the pledge to **fulfilled** — nothing has to be entered twice, and the pledge never just quietly disappears without a paper trail

## Testing checklist before sharing the real links

- [ ] Log in as each of the 3 usernames for the first time, confirm PIN setup works
- [ ] Log out and back in with the PIN just set, confirm it's remembered
- [ ] Add one income entry, one expense entry, confirm both show up correctly on the public page
- [ ] Add a pledge, confirm it shows as pending on the public page
- [ ] Mark that pledge fulfilled, confirm it disappears from "pending" and shows up as a real entry in the ledger
- [ ] Open the public page in a completely different browser (not logged in) — confirm you can see everything but there's no way to edit anything
