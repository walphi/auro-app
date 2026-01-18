#!/bin/bash

# Supabase Database Backup Script
# This script performs a full backup of the Supabase database using the Supabase CLI.

set -e # Exit immediately if a command exits with a non-zero status

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
SCHEMA_FILE="${BACKUP_DIR}/schema_${TIMESTAMP}.sql"
ROLES_FILE="${BACKUP_DIR}/roles_${TIMESTAMP}.sql"
DATA_FILE="${BACKUP_DIR}/data_${TIMESTAMP}.sql"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting Supabase database backup..."

# Check if db-url is provided as an environment variable
if [ -n "$SUPABASE_DB_URL" ]; then
    echo "Using SUPABASE_DB_URL for connection..."
    CONNECTION_FLAGS="--db-url $SUPABASE_DB_URL"
else
    echo "Using linked project for connection (assuming 'supabase link' was run)..."
    CONNECTION_FLAGS=""
fi

# 1. Backup Roles (Optional but recommended)
echo "Dumping roles..."
supabase db dump --role-only $CONNECTION_FLAGS > "$ROLES_FILE" || { echo "Failed to dump roles"; exit 1; }

# 2. Backup Schema
echo "Dumping schema..."
supabase db dump $CONNECTION_FLAGS > "$SCHEMA_FILE" || { echo "Failed to dump schema"; exit 1; }

# 3. Backup Data
echo "Dumping data (using --use-copy --data-only)..."
supabase db dump --data-only --use-copy $CONNECTION_FLAGS > "$DATA_FILE" || { echo "Failed to dump data"; exit 1; }

echo "Backup completed successfully!"
echo "Files created:"
echo " - $ROLES_FILE"
echo " - $SCHEMA_FILE"
echo " - $DATA_FILE"
