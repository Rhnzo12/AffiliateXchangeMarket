# Cloudinary Upload & Fetch Guide

The application uses **Cloudinary** for both uploads and retrieval. Use the steps below to request upload parameters, send files via multipart form data, and persist the returned `public_id`/URLs for later fetching.

## 1) Request upload parameters
Call your backend endpoint that returns the Cloudinary upload URL plus any required signing fields. A typical payload includes:

```json
{
  "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload",
  "uploadPreset": "your_unsigned_or_signed_preset",
  "folder": "affiliatexchange/uploads",
  "apiKey": "<cloudinary_api_key>",
  "timestamp": 1720000000,
  "signature": "<signature_if_required>",
  "fields": { "context": "optional extra fields" }
}
```

Persist the `public_id` and the secure URL from the upload response in the database for later use.

## 2) Upload the file (frontend example)
The `CloudinaryUploader` component posts the file as multipart form data. If you are uploading manually, mimic this pattern:

```javascript
const formData = new FormData();
formData.append('file', file); // required
formData.append('upload_preset', params.uploadPreset);
formData.append('folder', params.folder);
formData.append('api_key', params.apiKey);
formData.append('timestamp', params.timestamp);
formData.append('signature', params.signature);

// include any extra fields you need (e.g., context)
Object.entries(params.fields || {}).forEach(([key, value]) => {
  formData.append(key, value);
});

const response = await fetch(params.uploadUrl, {
  method: 'POST',
  body: formData,
});

const result = await response.json();
// Save result.public_id and result.secure_url
```

## 3) Fetching/displaying uploads
Once uploaded, assets can be fetched directly via Cloudinary delivery URLs. Construct URLs using the `public_id` and desired transformations, e.g.:

```
https://res.cloudinary.com/<cloud_name>/image/upload/w_800,q_auto/<public_id>.jpg
```

For videos, swap `image` with `video` and use the appropriate extension. Signed delivery URLs can be generated server-side if you need additional protection.

## Notes
- Uploads **do not** go to Google Cloud Storage; Cloudinary handles storage and delivery.
- Store the `public_id` returned from Cloudinary so you can fetch or transform assets later.
- Keep API keys and signing secrets out of the client; only share the signature, timestamp, and preset values needed for the upload.
