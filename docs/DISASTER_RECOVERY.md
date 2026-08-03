# disaster_recovery — Disaster Recovery Guide

This guide details the backup, validation, and restoration strategy for AniVerse systems in production.

## 1. Automated Backups Strategy

We recommend setting up a daily automated pg_dump cron job targeting your PostgreSQL production database. The script should archive the dump to an isolated secure storage bucket (e.g. AWS S3 or GCS) with a 30-day retention policy.

### Backup Command
```bash
pg_dump -h localhost -U aniverse_user -d aniverse_db -F c -b -v -f "/backups/aniverse_db_$(date +%F).dump"
```

---

## 2. Restore Testing Procedure

To verify backup archival health regularly, follow these validation steps:

1. **Spin up temporary PostgreSQL container**:
   ```bash
   docker run --name pg-test -e POSTGRES_PASSWORD=test -p 5439:5432 -d postgres:15
   ```
2. **Restore backup dump file**:
   ```bash
   pg_restore -h localhost -p 5439 -U postgres -d postgres -v "/backups/aniverse_db_YYYY-MM-DD.dump"
   ```
3. **Verify core tables indices presence**:
   ```bash
   psql -h localhost -p 5439 -U postgres -d postgres -c "\dt"
   ```

---

## 3. Migration Rollback Policy

For any schema alterations, write corresponding down migrations using Alembic.
To roll back the last executed migration step:
```bash
alembic downgrade -1
```
Verify the active schema version using:
```bash
alembic current
```
