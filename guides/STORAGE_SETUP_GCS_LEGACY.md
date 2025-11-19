# Google Cloud Storage Setup Guide

Your video upload feature requires Google Cloud Storage to store video files. Follow these steps to set it up:

## Quick Setup (5 minutes)

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it: `affiliatexchange-storage` (or your choice)
4. Click "Create"
5. Wait for project creation, then select it

### 2. Enable Cloud Storage API

1. In the search bar, type "Cloud Storage API"
2. Click "Enable" button
3. Wait ~30 seconds for activation

### 3. Create Storage Bucket

1. Go to [Cloud Storage Buckets](https://console.cloud.google.com/storage/browser)
2. Click "Create Bucket"
3. **Name:** Choose unique name (e.g., `affiliatexchange-videos-[your-name]`)
4. **Location:** Choose closest region (e.g., `us-central1`, `asia-southeast1`)
5. **Storage class:** Standard
6. **Access control:** Uniform
7. **Public access:** UNCHECK "Enforce public access prevention"
8. Click "Create"

### 4. Make Bucket Public (for video access)

1. Click on your bucket name
2. Go to "Permissions" tab
3. Click "Grant Access"
4. **New principals:** `allUsers`
5. **Role:** Storage Object Viewer
6. Click "Save" → Confirm "Allow Public Access"

### 5. Create Service Account

1. Go to [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "Create Service Account"
3. **Name:** `affiliatexchange-storage-admin`
4. **Description:** "Service account for AffiliateXchange video uploads"
5. Click "Create and Continue"
6. **Role:** Select "Cloud Storage" → "Storage Admin"
7. Click "Continue" → "Done"

### 6. Create Service Account Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. **Type:** JSON
5. Click "Create"
6. **A JSON file will download** - save it securely!

### 7. Add Credentials to .env

**Option A: Using Key File Path (Recommended)**

1. Create a `keys` folder in your project:
   ```bash
   mkdir keys
   ```

2. Move the downloaded JSON file to `keys/gcs-key.json`

3. Add to your `.env` file:
   ```env
   # Google Cloud Storage Configuration
   GOOGLE_APPLICATION_CREDENTIALS=./keys/gcs-key.json
   DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-name-here
   PRIVATE_OBJECT_DIR=.private
   PUBLIC_OBJECT_SEARCH_PATHS=public
   ```

4. Add to `.gitignore` (IMPORTANT!):
   ```
   keys/
   *.json
   ```

**Option B: Using JSON Key Content**

1. Open the downloaded JSON file
2. Copy the entire content
3. Add to your `.env` file:
   ```env
   # Google Cloud Storage Configuration
   GCS_PROJECT_ID=your-project-id
   GCS_KEY_FILE='{"type":"service_account","project_id":"your-project-id",...}'
   DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-name-here
   ```

### 8. Update Bucket Name

Replace `your-bucket-name-here` with your actual bucket name from step 3.

Example:
```env
DEFAULT_OBJECT_STORAGE_BUCKET_ID=affiliatexchange-videos-john
```

### 9. Restart Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 10. Test Video Upload

1. Go to an approved retainer contract
2. Click "Submit Video"
3. Upload a video file
4. Should work without ECONNREFUSED error! ✅

---

## Troubleshooting

### Error: "ECONNREFUSED 127.0.0.1:1106"
- ✅ Make sure you added `GOOGLE_APPLICATION_CREDENTIALS` or `GCS_KEY_FILE` to `.env`
- ✅ Restart your server after updating `.env`
- ✅ Check that the key file path is correct

### Error: "The caller does not have permission"
- ✅ Service account needs "Storage Admin" role
- ✅ Go to IAM & Admin → IAM → Find your service account → Edit → Add "Storage Admin"

### Error: "Bucket not found"
- ✅ Check `DEFAULT_OBJECT_STORAGE_BUCKET_ID` matches your bucket name exactly
- ✅ Bucket name is case-sensitive
- ✅ No spaces or special characters

### Videos upload but can't be viewed
- ✅ Make bucket public (step 4)
- ✅ Add "allUsers" with "Storage Object Viewer" role to bucket permissions

### Error: "Invalid JSON in GCS_KEY_FILE"
- ✅ Make sure to wrap the entire JSON in single quotes
- ✅ Don't modify the JSON content
- ✅ Use Option A (file path) if Option B doesn't work

---

## Cost Estimate

**Google Cloud Storage Pricing (approximate):**
- **Storage:** $0.02 per GB/month
- **Operations:** $0.004 per 10,000 operations
- **Network egress:** $0.12 per GB (to users)

**Example:**
- 100 videos × 50MB each = 5GB storage = **$0.10/month**
- 1,000 video views = 50GB transfer = **$6/month**

**Free Tier:**
- First 5GB storage: FREE
- First 5,000 operations: FREE

---

## Security Best Practices

1. ✅ **Never commit** `.env` or service account JSON files to git
2. ✅ **Add to .gitignore:**
   ```
   .env
   .env.local
   keys/
   *.json
   ```
3. ✅ **Rotate keys regularly** (every 90 days)
4. ✅ **Use separate buckets** for dev/staging/production
5. ✅ **Set CORS if needed** for direct browser uploads

---

## Alternative: Free Storage Options

If you don't want to use Google Cloud Storage, you can use:

### Cloudflare R2 (10GB free)
- Compatible with S3 API
- No egress fees
- [Setup guide](https://developers.cloudflare.com/r2/)

### Supabase Storage (1GB free)
- Easy setup
- Built-in auth
- [Setup guide](https://supabase.com/docs/guides/storage)

### AWS S3 (5GB free for 12 months)
- Industry standard
- Free tier for new accounts
- [Setup guide](https://aws.amazon.com/s3/getting-started/)

**Note:** Using alternatives requires code changes to storage client configuration.

---

## Need Help?

1. Check Google Cloud Console for error messages
2. Verify all permissions are set correctly
3. Test with a small video file first (<5MB)
4. Check browser console and server logs for detailed errors

Your videos will be stored at:
`https://storage.googleapis.com/your-bucket-name/path/to/video.mp4`
