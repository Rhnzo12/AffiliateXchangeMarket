import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dilp6tuin',
  api_key: '167124276676481',
  api_secret: 'BWaaOtS7sZ_ellwAV-zE-eyxanU',
});

const videoPath = 'C:\\Users\\harol\\Downloads\\Ill_fill_out_202510230100_9x5p8.mp4';

cloudinary.uploader.upload(videoPath, {
  resource_type: 'video',
  folder: 'affiliatexchange/videos',
  public_id: 'kzrtkicvvpq2qjhmkegn'
})
.then(result => {
  console.log('✅ Video uploaded successfully!');
  console.log('Public ID:', result.public_id);
  console.log('URL:', result.secure_url);
})
.catch(error => {
  console.error('❌ Upload failed:', error);
});
