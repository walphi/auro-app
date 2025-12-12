# Property Listings Deployment Steps

## ⚠️ CRITICAL: Database Setup Required First

The error you're seeing (`PGRST202: Could not find the function public.search_property_listings`) occurs because the database schema hasn't been created yet.

## Step 1: Run SQL in Supabase (REQUIRED)

1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to**: Your Project → SQL Editor
3. **Copy the entire contents** of `sql/property_listings.sql` from this branch
4. **Paste and Run** the SQL script

This will create:
- ✅ `property_listings` table
- ✅ `search_property_listings()` function
- ✅ Indexes for performance
- ✅ RLS policies
- ✅ Permissions

## Step 2: Set Environment Variables in Netlify

Add these to your Netlify environment variables:

```
PARSEBOT_API_URL=<your_parsebot_api_url>
PARSEBOT_API_KEY=<your_parsebot_api_key>
```

## Step 3: Merge and Deploy

```bash
# Merge the PR
gh pr merge 3 --squash

# Deploy will happen automatically via Netlify
```

## Step 4: Sync Initial Data

After deployment, trigger the sync function:

```bash
curl https://your-site.netlify.app/api/sync-listings
```

Or visit it in your browser to populate the initial listings.

## Verification

Test by sending a WhatsApp message:
```
"What properties do you have in Dubai Marina?"
```

The agent should now return actual listings instead of the error.

---

## Current Status

- ✅ Code is ready in PR #3
- ❌ Database schema NOT created yet ← **This is blocking you**
- ❌ Environment variables not set
- ❌ Data not synced

**Next Action**: Run the SQL script in Supabase SQL Editor immediately.
