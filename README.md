# MYA E-Commerce Partner — Supabase Ready

This is a GitHub-ready HR/worker management web app for MYA E-Commerce Partner.

## Included

- Owner / Manager / Worker roles
- Supabase Auth email + password login
- Secure Row Level Security (RLS)
- Worker management
- Attendance
- Daily tasks + progress
- Reports
- Your supplied MYA logo
- Mobile responsive dashboard
- JSON export
- Optional Edge Function for Owner/Manager to create login accounts

## 1. Create Supabase project

Create a project at https://supabase.com/ .

Open **SQL Editor**, paste the complete `supabase.sql`, and run it.

## 2. Create the first Owner

In Supabase:
**Authentication → Users → Add user → Create new user**

Create the owner's email/password.

Then in SQL Editor run:

```sql
update public.profiles
set role='owner', status='Active', full_name='Muhammad Yaseen Arain'
where email='YOUR_OWNER_EMAIL';
```

The auth trigger automatically creates the profile row when the auth user is created.

## 3. Add Supabase keys

Open `app.js` and replace:

```js
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

with the **Project URL** and **anon/publishable key** from:
Supabase → Project Settings → API.

### IMPORTANT

Put only the public **anon/publishable key** in `app.js`.

**Never** put the Supabase `service_role` key in GitHub or browser JavaScript.

## 4. Enable login provider

Supabase → Authentication → Providers → Email

Keep Email enabled.

For a simple internal company system you can use confirmed users. The included Edge Function creates accounts with email already confirmed.

## 5. Optional but recommended: deploy account-creation Edge Function

The Owner/Manager "Add Worker" form calls:

`supabase/functions/create-user/index.ts`

Install Supabase CLI, log in, link your project, then deploy:

```bash
supabase functions deploy create-user
```

The Supabase Edge Function already receives the project URL and service-role key securely from Supabase's server environment. Do **not** paste that key into `app.js`.

If you do not want an Edge Function, create Auth users manually from Supabase Authentication → Users; their profile is created automatically.

## 6. GitHub Pages

Upload these files/folders to a GitHub repository:

```text
index.html
style.css
app.js
logo.jpeg
supabase.sql
supabase/functions/create-user/index.ts
README.md
```

Then GitHub:
**Settings → Pages → Deploy from branch → main → / (root)**

Open the generated Pages URL.

## 7. First login

Use the Owner email/password you created in Supabase.

After login:
- Owner sees all workers, attendance and tasks.
- Manager can manage operational worker/task data.
- Worker can see only their own attendance and assigned tasks.
- RLS is enforced by Supabase, not just by hiding buttons in the frontend.

## Security note

This is a frontend GitHub Pages app backed by Supabase. The browser contains only the public anon/publishable key. Security comes from Supabase Auth + RLS.

If you later need payroll, salaries, payments, documents, audit logs or multi-company support, add those as separate protected tables/policies rather than storing them in localStorage.
