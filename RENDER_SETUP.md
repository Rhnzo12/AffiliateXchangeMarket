# Render Deployment Setup

## Google Cloud Storage Credentials

The application requires Google Cloud Storage credentials to handle media uploads and storage. In production environments like Render, credentials should be provided as environment variables rather than files.

### Setting Up Environment Variables in Render

1. Go to your Render dashboard
2. Select your web service
3. Navigate to the **Environment** tab
4. Add the following environment variable:

**GOOGLE_CLOUD_CREDENTIALS_JSON**
- Value: The entire contents of your Google Cloud service account JSON file
- This should be a single-line JSON string containing your credentials

Example structure (do not include newlines):
```json
{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

### Additional Required Environment Variables

Make sure these are also set in Render:

- `GOOGLE_CLOUD_PROJECT_ID`: Your Google Cloud project ID
- `GOOGLE_CLOUD_BUCKET_NAME`: Your GCS bucket name (e.g., `myapp-media-affiliate`)
- `GCS_FOLDER`: Optional folder path within the bucket (default: `affiliatexchange/videos`)

### How the Credentials Are Loaded

The application now supports three methods for loading credentials (in order of priority):

1. **GOOGLE_CLOUD_CREDENTIALS_JSON** (Recommended for production)
   - Loads credentials from JSON string environment variable
   - Best for deployment platforms like Render, Heroku, etc.

2. **GOOGLE_CLOUD_KEYFILE** (For local development)
   - Loads credentials from a file path
   - Useful when developing locally

3. **Default Credentials** (For GCP environments)
   - Uses Google Cloud's default credential chain
   - Automatically works when deployed on Google Cloud Platform

### Troubleshooting

If you see the error:
```
ENOENT: no such file or directory, open '/opt/render/project/src/config/...'
```

This means:
1. The `GOOGLE_CLOUD_KEYFILE` environment variable is set to a file path
2. The file doesn't exist in the deployed environment
3. **Solution**: Remove `GOOGLE_CLOUD_KEYFILE` and add `GOOGLE_CLOUD_CREDENTIALS_JSON` instead

### Getting Your Credentials JSON

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** → **Service Accounts**
3. Select your service account (or create a new one)
4. Go to the **Keys** tab
5. Click **Add Key** → **Create new key**
6. Select **JSON** format
7. Download the file
8. Copy the entire contents and paste into `GOOGLE_CLOUD_CREDENTIALS_JSON` in Render

**Important**: Keep your credentials secure and never commit them to your repository!
