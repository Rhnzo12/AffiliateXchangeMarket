# Google Cloud Storage Signed URLs - Implementation Guide

## Overview
This document explains the Google Cloud Storage (GCS) signed URL implementation for secure file uploads and downloads without requiring public bucket access.

## Prerequisites

### 1. Service Account Setup
- Service account created in Google Cloud Console
- Service account has `Storage Object Admin` role on the bucket
- Service account key downloaded as JSON file (e.g., `storage-key.json`)

### 2. Environment Variables
Add these to your `.env` file:

```bash
GOOGLE_CLOUD_PROJECT_ID=tool-development-478707
GOOGLE_CLOUD_BUCKET_NAME=myapp-media-affiliate
GOOGLE_CLOUD_KEYFILE=./storage-key.json  # Path to your service account key
```

### 3. Security
The service account key file (`storage-key.json`) is already included in `.gitignore` with the following patterns:
- `*-key.json`
- `gcs-*.json`
- `keys/`

**NEVER commit the service account key to version control!**

## Available Endpoints

### 1. Generate Signed Upload URL (Client-Side Upload)
**Endpoint:** `POST /api/objects/upload`
**Auth:** Required
**Description:** Generates a signed URL that the client can use to upload files directly to GCS

**Request Body:**
```json
{
  "folder": "affiliatexchange/uploads",  // optional, defaults to configured folder
  "resourceType": "image"  // optional: 'image', 'video', 'auto' (default)
}
```

**Response:**
```json
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "folder": "affiliatexchange/uploads",
  "contentType": "image/jpeg",
  "fields": {
    "key": "affiliatexchange/uploads/uuid",
    "bucket": "myapp-media-affiliate"
  }
}
```

**Usage Example (Frontend):**
```javascript
// Step 1: Get signed upload URL
const response = await fetch('/api/objects/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    folder: 'affiliatexchange/images',
    resourceType: 'image'
  })
});
const { uploadUrl, contentType } = await response.json();

// Step 2: Upload file directly to GCS using the signed URL
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': contentType },
  body: fileBlob  // Your file
});

if (uploadResponse.ok) {
  console.log('Upload successful!');
}
```

---

### 2. Generate Signed Download URL
**Endpoint:** `GET /api/get-signed-url/:filename`
**Auth:** Required
**Description:** Generates a temporary signed URL for reading/downloading an existing file

**Parameters:**
- `filename` - The full path to the file in GCS (e.g., `affiliatexchange/uploads/my-file.jpg`)

**Response:**
```json
{
  "url": "https://storage.googleapis.com/myapp-media-affiliate/affiliatexchange/uploads/file.jpg?X-Goog-Algorithm=..."
}
```

**Usage Example:**
```javascript
// Get signed URL for a file
const response = await fetch('/api/get-signed-url/affiliatexchange/uploads/my-file.jpg');
const { url } = await response.json();

// Use the signed URL to display/download the file
// The URL is valid for 1 hour
console.log('Signed URL:', url);
```

---

### 3. Direct File Upload (Server-Side Upload)
**Endpoint:** `POST /api/upload-file`
**Auth:** Required
**Description:** Upload a file directly to the server, which then uploads it to GCS and returns a signed URL

**Request:** Multipart form data
- `file` - The file to upload (required)
- `folder` - Target folder in GCS (optional, default: `affiliatexchange/uploads`)
- `resourceType` - Resource type hint (optional, default: `auto`)

**Response:**
```json
{
  "message": "File uploaded successfully",
  "filename": "affiliatexchange/uploads/uuid.jpg",
  "originalName": "photo.jpg",
  "url": "https://storage.googleapis.com/...?X-Goog-Algorithm=...",
  "publicUrl": "https://storage.googleapis.com/myapp-media-affiliate/affiliatexchange/uploads/uuid.jpg"
}
```

**Usage Example (Frontend with Fetch):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folder', 'affiliatexchange/images');

const response = await fetch('/api/upload-file', {
  method: 'POST',
  body: formData  // Don't set Content-Type header, browser will set it automatically
});

const result = await response.json();
console.log('File uploaded:', result.filename);
console.log('Signed URL:', result.url);
```

**Usage Example (Node.js with axios):**
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const formData = new FormData();
formData.append('file', fs.createReadStream('./photo.jpg'));
formData.append('folder', 'affiliatexchange/images');

const response = await axios.post('http://localhost:5000/api/upload-file', formData, {
  headers: formData.getHeaders()
});

console.log('Upload response:', response.data);
```

## Security Features

1. **Authentication Required**: All endpoints require user authentication
2. **Signed URLs**: Temporary URLs that expire after 1 hour
3. **No Public Access**: Files are not publicly accessible; access requires signed URLs
4. **CORS Configured**: Bucket has CORS configured to allow direct uploads from the frontend
5. **File Size Limit**: 100MB maximum file size for direct uploads

## CORS Configuration

The GCS bucket should have CORS configured. Here's the configuration:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
```

To apply CORS configuration:
```bash
gsutil cors set cors-config.json gs://myapp-media-affiliate
```

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. Request signed URL
       ▼
┌─────────────────┐
│  Express API    │
│  /api/objects/  │
│     upload      │
└────────┬────────┘
         │
         │ 2. Generate signed URL
         ▼
┌─────────────────────┐
│  Google Cloud      │
│    Storage SDK     │
└────────┬────────────┘
         │
         │ 3. Return signed URL
         ▼
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 4. Upload directly to GCS
       ▼
┌─────────────────────┐
│  Google Cloud      │
│    Storage         │
│    (Bucket)        │
└─────────────────────┘
```

## File Organization

Recommended folder structure in GCS:
```
myapp-media-affiliate/
├── affiliatexchange/
│   ├── uploads/          # General uploads
│   ├── images/           # Image uploads
│   ├── videos/           # Video uploads
│   └── logos/            # Company logos
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (missing file, invalid parameters)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `500` - Server error (upload failed, GCS error)

## Troubleshooting

### Issue: "Failed to generate URL"
**Solution:** Check that:
- `GOOGLE_CLOUD_KEYFILE` path is correct
- Service account key file exists and is valid
- Service account has proper permissions on the bucket

### Issue: "File uploaded but failed to generate signed URL"
**Solution:** The file was uploaded successfully, but signed URL generation failed. The file is still in GCS at the `publicUrl` provided.

### Issue: CORS errors in browser
**Solution:** Ensure CORS is properly configured on the GCS bucket using the configuration shown above.

## Best Practices

1. **Use Client-Side Uploads** (`/api/objects/upload`) for large files to reduce server load
2. **Use Server-Side Uploads** (`/api/upload-file`) for small files or when you need server-side validation
3. **Always use signed URLs** for file access instead of making files public
4. **Set appropriate expiration times** for signed URLs based on your use case
5. **Implement proper error handling** on the client side for upload failures

## Additional Resources

- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Signed URLs Overview](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [CORS Configuration](https://cloud.google.com/storage/docs/configuring-cors)
