# Supabase Database Backups

This document explains how to perform and manage backups for the Auro App Supabase database.

## Prerequisites

1.  **Supabase CLI**: Ensure the Supabase CLI is installed on your local machine.
2.  **Authentication**: You must be logged in via the CLI:
    ```bash
    supabase login
    ```
3.  **Project Link or DB URL**:
    *   Either link your project: `supabase link --project-ref <your-project-ref>`
    *   Or provide the `SUPABASE_DB_URL` environment variable (e.g., `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`).

## How to Run a Backup

We provide a script to automate the backup process:

```bash
bash scripts/backup-supabase.sh
```

### What it does:
The script creates a `backups/` directory (if it doesn't exist) and generates three timestamped files:
1.  `roles_YYYY-MM-DD.sql`: Database roles and permissions.
2.  `schema_YYYY-MM-DD.sql`: The full database schema.
3.  `data_YYYY-MM-DD.sql`: All table data using `COPY` statements.

### Using an explicit DB URL:
If you haven't linked the project, you can pass the connection string:
```bash
SUPABASE_DB_URL="your_connection_string" bash scripts/backup-supabase.sh
```

## How to Restore

> [!CAUTION]
> Restoring a database can be destructive and can lead to data loss if not done correctly. **Never** restore directly to a production environment without testing on a separate environment first.

Refer to the official [Supabase Backup and Restore](https://supabase.com/docs/guides/database/backup-and-restore) documentation for detailed instructions on using the CLI to restore.

Typically, you would run:
```bash
# To restore schema
psql -h <host> -U <user> -d <database> -f schema_YYYY-MM-DD.sql

# To restore data
psql -h <host> -U <user> -d <database> -f data_YYYY-MM-DD.sql
```
Make sure to restore roles first if they have changed.
