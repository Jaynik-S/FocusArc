# FocusArc Deployment Guide

## Architecture

- **Frontend:** Render Static Site (React/Vite)
- **Backend:** Render Web Service (FastAPI/Docker)
- **Database:** Neon PostgreSQL (Free tier)
- **Authentication:** Bearer token with owner username

## Prerequisites

1. Neon account with PostgreSQL database
2. Render account
3. GitHub repository connected to Render

## Environment Variables

### Backend (Render Web Service)

Required:
- DATABASE_URL: Neon PostgreSQL connection string (provided by Neon)
- OWNER_USERNAME: Fixed owner username (e.g., jayy)
- ACCESS_KEY: Strong random key (min 20 chars, keep secure)
- APP_ENV: Set to prod
- CORS_ORIGINS: Frontend URL (e.g., https://focusarc.onrender.com)

Optional:
- LOG_LEVEL: info (default) or debug
- PORT: Auto-set by Render (default 8000)

### Frontend (Render Static Site)

Required:
- VITE_API_BASE_URL: Backend URL with /api (e.g., https://focusarc-api.onrender.com/api)

Build command: 
pm ci && npm run build
Publish directory: dist

## Database Setup (Neon)

1. Create a new Neon project
2. Copy the connection string
3. Create a separate migration user with schema privileges:
   `sql
   CREATE USER migration_user WITH PASSWORD 'strong-password';
   GRANT ALL ON SCHEMA public TO migration_user;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO migration_user;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO migration_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO migration_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO migration_user;
   `
4. Use the migration user for one-time migration runs
5. Use the default user (with restricted privileges) for runtime API

## Initial Deployment

1. **Setup Neon Database:**
   - Create database and migration user as above
   - Store both connection strings securely

2. **Run Initial Migration:**
   `ash
   # Locally or in a one-time job
   export DATABASE_URL="postgresql+psycopg://migration_user:password@host/db"
   cd backend
   alembic upgrade head
   `

3. **Deploy Backend to Render:**
   - Create new Web Service from GitHub repo
   - Set root directory: ackend
   - Use Dockerfile
   - Add environment variables (use runtime user, not migration user)
   - Deploy

4. **Deploy Frontend to Render:**
   - Create new Static Site from GitHub repo
   - Set root directory: rontend
   - Build command: 
pm ci && npm run build
   - Publish directory: dist
   - Add VITE_API_BASE_URL environment variable
   - Deploy

5. **Verify Deployment:**
   - Visit backend health: https://your-api.onrender.com/api/health
   - Visit frontend: https://your-app.onrender.com
   - Unlock with your ACCESS_KEY
   - Verify timers load

## GitHub Actions Secrets

Add these to your GitHub repository secrets:
- RENDER_BACKEND_DEPLOY_HOOK: Backend deploy hook URL from Render
- RENDER_FRONTEND_DEPLOY_HOOK: Frontend deploy hook URL from Render
- BACKEND_URL: Backend base URL for health checks

## Data Migration from Local

After deployment is verified:

1. **Export local data:**
   `ash
   docker exec focusarc-db pg_dump -U coursetimers -Fc coursetimers > backup.dump
   `

2. **Restore to Neon:**
   `ash
   pg_restore -d "postgresql://user:pass@host/db" --clean --if-exists backup.dump
   `

3. **Verify data:**
   - Check session counts
   - Verify timer totals
   - Confirm historical records

## Local Development

Local development still uses Docker Compose:
`ash
docker compose up
`

Access at http://localhost:5173 with username-only auth (no ACCESS_KEY needed).

## Security Notes

- Keep ACCESS_KEY secret and secure
- Use a password manager or secure note
- ACCESS_KEY is not in Git, Docker images, or frontend bundles
- Frontend stores it in sessionStorage (cleared on browser close)
- Lock the app when not in use
- Backend rejects all requests without valid bearer token in production

## Troubleshooting

**Backend won't start:**
- Check DATABASE_URL is valid
- Verify OWNER_USERNAME and ACCESS_KEY are set
- Check logs for validation errors

**Frontend 401 errors:**
- Verify VITE_API_BASE_URL matches backend URL
- Check CORS_ORIGINS includes frontend URL
- Confirm ACCESS_KEY is correct

**Database connection errors:**
- Verify Neon database is active
- Check connection string format
- Ensure IP is not blocked

**Cold start delays:**
- Render free tier spins down after inactivity
- First request may take 30-60 seconds
- Consider paid tier for always-on

## Backup Strategy

1. Automated Neon backups (check retention policy)
2. Manual pg_dump before schema changes
3. Test restore process periodically
4. Store backups outside of Render/Neon
