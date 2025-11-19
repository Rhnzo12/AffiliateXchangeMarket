# Deploying AffiliateXchange to Render - Complete Guide

This guide will walk you through deploying your AffiliateXchange application to Render.

## Prerequisites

- ✅ GitHub account with your repository
- ✅ Render account (free tier available)
- ✅ Google OAuth credentials
- ✅ Cloudinary account for file uploads
- ✅ **Neon database** (you already have this!)

---

## 🎯 Using Your Existing Neon Database

**Great news!** Since you already have a Neon database, you can **skip Part 2** (creating PostgreSQL on Render) and use your existing Neon database instead.

### Why Use Neon?
- ✅ Serverless PostgreSQL with autoscaling
- ✅ Better free tier (3GB storage vs Render's 1GB)
- ✅ Instant database branching for testing
- ✅ Better cold start performance

### What You'll Need from Neon

1. Go to your [Neon Console](https://console.neon.tech/)
2. Select your project
3. Go to **"Dashboard"** or **"Connection Details"**
4. Copy your **Connection String** (looks like this):
   ```
   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

**Important:** Make sure the connection string includes `?sslmode=require` at the end!

### Quick Deployment Path (For Neon Users)

Since you have Neon, your deployment path is simpler:

1. ✅ **Part 1**: Create Render account
2. ⏭️ **Part 2**: SKIP (you have Neon!)
3. ✅ **Part 3**: Run migrations on your Neon database
4. ✅ **Part 4**: Deploy web service to Render
5. ✅ **Part 5**: Update Google OAuth redirect URIs

That's it! Much simpler than the full guide.

---

## Part 1: Create Render Account

1. Go to [https://render.com](https://render.com)
2. Click **"Get Started"** or **"Sign Up"**
3. Sign up with your **GitHub account** (recommended for easy deployment)
4. Verify your email address

---

## Part 2: Create PostgreSQL Database

> **⚠️ SKIP THIS PART** if you're using Neon database (which you are!)
>
> This section is only for users who want to create a new PostgreSQL database on Render.

### Step 1: Create Database

1. From Render Dashboard, click **"New +"** button
2. Select **"PostgreSQL"**
3. Configure database:
   - **Name**: `affiliatexchange-db` (or any name you prefer)
   - **Database**: `affiliatexchange`
   - **User**: `affiliatexchange_user` (auto-generated)
   - **Region**: Choose closest to your users (e.g., Oregon USA, Frankfurt EU)
   - **Plan**: **Free** (or paid plan for production)
4. Click **"Create Database"**

### Step 2: Get Database Connection Details

After database is created:

1. Click on your database name
2. Go to **"Info"** section
3. Copy these values (you'll need them later):
   - **Internal Database URL** (for connecting from Render services)
   - **External Database URL** (for running migrations from your local machine)

**Important URLs:**
- Internal URL format: `postgresql://user:pass@hostname/dbname`
- External URL format: `postgresql://user:pass@external-hostname/dbname`

---

## Part 3: Run Database Migrations

### For Neon Database Users (That's You!)

1. **Get your Neon connection string** from [Neon Console](https://console.neon.tech/)
   - It should look like: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require`

2. **Set environment variable temporarily:**
   ```bash
   # Windows (PowerShell)
   $env:DATABASE_URL="postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require"

   # Windows (CMD)
   set DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require

   # Mac/Linux
   export DATABASE_URL="postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require"
   ```

### For Render Database Users (Alternative)

1. **Copy the External Database URL** from Render dashboard

2. **Set environment variable temporarily:**
   ```bash
   # Windows (PowerShell)
   $env:DATABASE_URL="postgresql://user:pass@external-host/dbname"

   # Windows (CMD)
   set DATABASE_URL=postgresql://user:pass@external-host/dbname

   # Mac/Linux
   export DATABASE_URL="postgresql://user:pass@external-host/dbname"
   ```

3. **Run all migrations:**
   ```bash
   # Run each migration in order
   psql $DATABASE_URL -f db/migrations/002_add_notifications.sql
   psql $DATABASE_URL -f db/migrations/003_fix_reviews_schema.sql
   psql $DATABASE_URL -f db/migrations/004_migrate_reviews_to_new_schema.sql
   psql $DATABASE_URL -f db/migrations/005_hotfix_reviews_rating_constraint.sql
   psql $DATABASE_URL -f db/migrations/006_add_google_oauth.sql
   psql $DATABASE_URL -f db/migrations/fix_schema_types.sql
   ```

4. **Verify migrations:**
   ```bash
   psql $DATABASE_URL -c "\dt"
   ```
   You should see all your tables listed.

### Option B: Using Render Shell (Alternative)

1. After deploying web service (Part 4), go to web service dashboard
2. Click **"Shell"** tab
3. Run migrations one by one:
   ```bash
   psql $DATABASE_URL -f db/migrations/002_add_notifications.sql
   # ... repeat for all migrations
   ```

---

## Part 4: Deploy Web Service

### Step 1: Create Web Service

1. From Render Dashboard, click **"New +"** button
2. Select **"Web Service"**
3. Choose **"Build and deploy from a Git repository"**
4. Click **"Connect a repository"**
5. Select your **AffiliateXchange** repository
6. Click **"Connect"**

### Step 2: Configure Web Service

Fill in the following settings:

#### Basic Settings
- **Name**: `affiliatexchange` (or any name, this becomes your-app-name.onrender.com)
- **Region**: Same as your database (for better performance)
- **Branch**: `main` (or your deployment branch)
- **Root Directory**: Leave empty (blank)
- **Runtime**: **Node**

#### Build & Deploy Settings
- **Build Command**:
  ```bash
  npm install && npm run build
  ```
- **Start Command**:
  ```bash
  npm start
  ```

#### Plan
- **Instance Type**: **Free** (or paid for production)

**Important:** Free tier sleeps after 15 minutes of inactivity. Upgrade to paid tier ($7/month) for always-on service.

### Step 3: Add Environment Variables

Click **"Advanced"** button, then add these environment variables:

#### Required Variables

```bash
# Database - USE YOUR NEON CONNECTION STRING
# Get this from Neon Console > Dashboard > Connection Details
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require

# Or if using Render PostgreSQL (use Internal Database URL from your PostgreSQL service)
# DATABASE_URL=postgresql://user:pass@internal-hostname/dbname

# Session Secret (generate a random string)
SESSION_SECRET=your-random-secret-here-change-this-in-production

# Node Environment
NODE_ENV=production

# Cloudinary (from your Cloudinary dashboard)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
CLOUDINARY_FOLDER=affiliatexchange/videos

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BASE_URL=https://your-app-name.onrender.com
GOOGLE_CALLBACK_URL=/api/auth/google/callback

# VAPID Keys for Push Notifications (optional)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@yourdomain.com

# SendGrid for Email (optional)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

#### How to Generate SESSION_SECRET

**On Mac/Linux:**
```bash
openssl rand -hex 32
```

**On Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

**Or use online:** https://randomkeygen.com/

### Step 4: Deploy

1. Click **"Create Web Service"** button
2. Wait for deployment to complete (5-10 minutes)
3. Watch the logs for any errors

---

## Part 5: Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add your Render URL to **Authorized redirect URIs**:
   ```
   https://your-app-name.onrender.com/api/auth/google/callback
   ```
4. Click **"Save"**
5. Wait 5 minutes for changes to propagate

---

## Part 6: Configure Custom Domain (Optional)

### Step 1: Add Custom Domain in Render

1. Go to your web service dashboard
2. Click **"Settings"** tab
3. Scroll to **"Custom Domain"** section
4. Click **"Add Custom Domain"**
5. Enter your domain (e.g., `affiliatexchange.com` or `app.affiliatexchange.com`)

### Step 2: Update DNS Records

Render will show you DNS records to add. In your domain registrar (GoDaddy, Namecheap, etc.):

**For root domain (affiliatexchange.com):**
- Add **A Record**: `76.76.21.21`

**For subdomain (app.affiliatexchange.com):**
- Add **CNAME Record**: `your-app-name.onrender.com`

### Step 3: Update Environment Variables

After adding custom domain:

1. Go to **"Environment"** tab
2. Update `BASE_URL`:
   ```
   BASE_URL=https://yourdomain.com
   ```
3. Click **"Save Changes"** (triggers redeploy)

### Step 4: Update Google OAuth Again

Update redirect URI in Google Cloud Console:
```
https://yourdomain.com/api/auth/google/callback
```

---

## Part 7: Verify Deployment

### Test Checklist

1. ✅ **Homepage loads**: Visit `https://your-app-name.onrender.com`
2. ✅ **Database connected**: Check logs for database connection
3. ✅ **Registration works**: Try creating a new account
4. ✅ **Login works**: Try logging in
5. ✅ **Google OAuth works**: Try "Continue with Google"
6. ✅ **File uploads work**: Try uploading an image
7. ✅ **WebSocket works**: Try sending messages

### Check Logs

To view logs:
1. Go to your web service dashboard
2. Click **"Logs"** tab
3. Look for any errors

### Common Issues

#### Issue 1: Database Connection Failed

**For Neon Database:**
- **Solution**: Verify connection string includes `?sslmode=require` at the end
- **Solution**: Check your Neon database is active (not paused)
- **Solution**: Verify database name and credentials are correct
- **Solution**: Ensure Neon project has "IP Allow List" disabled or includes Render IPs

**For Render PostgreSQL:**
- **Solution**: Verify `DATABASE_URL` is the **Internal Database URL**
- **Solution**: Check database is in same region as web service

#### Issue 2: Google OAuth Fails
- **Solution**: Verify redirect URI matches exactly in Google Cloud Console
- **Solution**: Check `BASE_URL` environment variable is correct
- **Solution**: Wait 5 minutes after updating Google OAuth settings

#### Issue 3: App Sleeps (Free Tier)
- **Solution**: Upgrade to paid tier ($7/month)
- **Solution**: Use a service like [Render Sleeper](https://rendersleeper.onrender.com/) to keep it awake

#### Issue 4: WebSocket Not Working
- **Solution**: Ensure `NODE_ENV=production` is set
- **Solution**: Check logs for WebSocket connection errors

---

## Part 8: Environment-Specific Configuration

### Update .env.example (For Future Reference)

Add a production section:

```bash
# Production Deployment (Render.com)
# 1. Use Internal Database URL from Render PostgreSQL
# 2. Set BASE_URL to your Render URL or custom domain
# 3. Update Google OAuth redirect URI in Google Cloud Console
# 4. Set NODE_ENV=production
```

---

## Part 9: Continuous Deployment

### Auto-Deploy on Git Push

Render automatically deploys when you push to your connected branch:

1. Make changes locally
2. Commit changes:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```
3. Render will automatically detect the push and redeploy

### Manual Deploy

To manually trigger a deploy:
1. Go to web service dashboard
2. Click **"Manual Deploy"** button
3. Select **"Clear build cache & deploy"** if you need a fresh build

---

## Part 10: Monitoring & Maintenance

### Monitor Performance

1. Go to **"Metrics"** tab to see:
   - CPU usage
   - Memory usage
   - Request rate
   - Response time

### View Logs

1. Go to **"Logs"** tab
2. Filter by:
   - **Deploy**: Build and deployment logs
   - **All**: Application logs
   - **Error**: Only error logs

### Database Backups

**Free Tier:** No automatic backups
**Paid Tier:** Automatic daily backups

To manually backup:
```bash
pg_dump $DATABASE_URL > backup.sql
```

---

## Part 11: Cost Estimation

### Free Tier (Using Neon Database)
- **Render Web Service**: 750 hours/month (sleeps after inactivity) - $0
- **Neon Database**: 3GB storage, unlimited compute - $0
- **Total**: $0/month ✨

### Free Tier (Using Render PostgreSQL)
- **Web Service**: 750 hours/month (sleeps after inactivity) - $0
- **PostgreSQL**: 1GB storage, 97 connection hours/month - $0
- **Total**: $0/month

### Starter Tier (Recommended for Production)
- **Render Web Service**: Always-on, 512MB RAM - $7/month
- **Neon Database Free Tier**: 3GB storage - $0
- **Total**: $7/month 🎉

### Starter Tier (All Render)
- **Web Service**: Always-on, 512MB RAM - $7/month
- **PostgreSQL**: 1GB storage, unlimited connections - $7/month
- **Total**: $14/month

### Professional Tier
- **Web Service**: 2GB RAM - $25/month
- **PostgreSQL**: 10GB storage - $20/month
- **Total**: $45/month

---

## Part 12: Post-Deployment Checklist

After successful deployment:

- [ ] Test all main features (register, login, browse, messages)
- [ ] Test Google OAuth login
- [ ] Test file uploads (Cloudinary)
- [ ] Test WebSocket (real-time messages)
- [ ] Set up monitoring/alerts
- [ ] Add custom domain (optional)
- [ ] Enable SSL (automatic with Render)
- [ ] Set up error tracking (Sentry, optional)
- [ ] Configure backup strategy
- [ ] Document deployment process for team

---

## Troubleshooting Guide

### Build Fails

**Error: "npm install failed"**
- Check `package.json` for syntax errors
- Verify all dependencies are listed
- Try clearing build cache

**Error: "Build command failed"**
- Check `npm run build` works locally
- Verify all TypeScript types are correct
- Check for missing environment variables during build

### Runtime Errors

**Error: "Application failed to respond"**
- Check `npm start` command is correct
- Verify PORT environment variable is not set (Render provides it)
- Check logs for startup errors

**Error: "Database connection failed"**
- Use Internal Database URL, not External
- Check database is running
- Verify connection string format

### Performance Issues

**Slow Response Times**
- Upgrade to paid tier
- Check database query performance
- Enable connection pooling
- Consider adding Redis cache

---

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Custom Domains](https://render.com/docs/custom-domains)

---

## Need Help?

If you encounter issues:
1. Check Render logs first
2. Verify all environment variables
3. Test database connection
4. Review this guide's troubleshooting section
5. Contact Render support (support@render.com)

---

**Deployment Complete!** 🎉

Your AffiliateXchange app should now be live at: `https://your-app-name.onrender.com`
