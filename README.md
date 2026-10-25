# PomFit

PomFit is a shared meal, grocery, prep, seasoning, and individualized workout planner for Clark and Elizabeth.

## Architecture

- GitHub Pages hosts the PWA
- Supabase Auth handles individual sign-in
- Supabase Postgres stores shared household planning plus private per-user state
- Supabase Realtime synchronizes the household grocery/prep state
- Row Level Security is enabled on all exposed tables

## First-use flow

1. Clark creates a PomFit account and chooses **Create Bonham household**.
2. PomFit shows an 8-character household join code.
3. Elizabeth creates her own PomFit account and enters that code.
4. Meals, groceries, and prep are shared. Private notes and individual workout settings remain account-specific.

## Security

Only the Supabase **publishable** browser key is in the public repository. Never add a secret/service-role key here. Database access is restricted by Row Level Security.

## GitHub Pages

In **Settings → Pages**, set **Source** to **GitHub Actions**. The included workflow then deploys the repository automatically on each push to `main`.
