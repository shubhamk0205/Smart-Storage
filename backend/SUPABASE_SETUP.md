# Supabase Setup Guide for Smart Storage System

This guide will help you set up Supabase as your PostgreSQL database for the Smart Storage System.

## Why Supabase?

- ✅ **Free tier** with 500MB database storage
- ✅ **Managed PostgreSQL** - no local installation needed
- ✅ **Automatic backups** and high availability
- ✅ **Built-in dashboard** to view your tables and data
- ✅ **SSL/TLS** connections by default
- ✅ **Global CDN** for fast connections

## Step-by-Step Setup

### 1. Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign In"**
3. Sign up with GitHub, Google, or email

### 2. Create a New Project

1. Once logged in, click **"New Project"**
2. Fill in the project details:
   - **Name**: `smart-storage` (or any name you prefer)
   - **Database Password**: Choose a **strong password** and **save it securely!**
   - **Region**: Choose the region closest to your location for best performance
   - **Pricing Plan**: Select **"Free"** for development
3. Click **"Create new project"**
4. Wait 1-2 minutes for your database to be provisioned

### 3. Get Your Database Connection String

1. In your Supabase dashboard, click on your project
2. Go to **Settings** (⚙️ icon in the left sidebar)
3. Click on **Database** in the settings menu
4. Scroll down to the **"Connection string"** section
5. Click on the **"URI"** tab
6. You'll see a connection string like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```
7. **Copy this string**
8. Replace `[YOUR-PASSWORD]` with the actual database password you created in Step 2

### 4. Update Your .env File

Open your `.env` file in the backend folder and update these lines:

```env
# Replace with your actual Supabase connection string
DATABASE_URL=postgresql://postgres:your_actual_password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
PG_SSL=true
```

**Example:**
```env
DATABASE_URL=postgresql://postgres:MySecurePass123@db.abcdefghijklmnop.supabase.co:5432/postgres
PG_SSL=true
```

### 5. Test Your Connection

Run the test script to verify your database connection:

```bash
node test-db.js
```

You should see:
```
Testing PostgreSQL connection...
✅ PostgreSQL connection successful!
Database version: PostgreSQL 15.x on x86_64-pc-linux-gnu...
```

### 6. Start Your Application

```bash
npm run dev
```

Your app will now connect to Supabase!

## Viewing Your Data in Supabase

1. Go to your Supabase dashboard
2. Click on **"Table Editor"** in the left sidebar
3. You'll see all the auto-created tables like:
   - `media_jpg`
   - `media_png`
   - `media_mp4`
   - etc.

You can browse, filter, and query your data directly in the Supabase UI!

## Troubleshooting

### Connection Timeout
- Make sure your connection string is correct
- Check that `PG_SSL=true` is set
- Verify your Supabase project is active (not paused)

### Authentication Failed
- Double-check your database password
- Make sure there are no extra spaces in the connection string

### Tables Not Appearing
- Tables are created automatically when you upload files
- Try uploading a file through the `/ingest` endpoint first

## Connection String Format

The Supabase connection string follows this format:

```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

Where:
- **USER**: Always `postgres` for Supabase
- **PASSWORD**: Your database password
- **HOST**: Your Supabase project host (e.g., `db.abcdefghijklmnop.supabase.co`)
- **PORT**: Always `5432`
- **DATABASE**: Always `postgres` for Supabase

## Security Best Practices

1. ✅ Never commit your `.env` file to git
2. ✅ Use strong database passwords
3. ✅ Enable Row Level Security (RLS) in Supabase for production
4. ✅ Rotate your database password periodically
5. ✅ Use environment-specific projects (dev, staging, prod)

## Free Tier Limits

Supabase free tier includes:
- **Database**: 500 MB storage
- **Bandwidth**: 5 GB per month
- **API Requests**: Unlimited
- **Paused after 1 week of inactivity** (but easy to resume)

Perfect for development and small projects!

## Next Steps

Once your database is connected:

1. Add your Cloudinary credentials to `.env`
2. Test the `/ingest` endpoint with some files
3. View the auto-created tables in Supabase
4. Query your data through the API

Happy coding! 🚀
