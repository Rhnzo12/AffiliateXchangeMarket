import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dilp6tuin',
  api_key: '167124276676481',
  api_secret: 'BWaaOtS7sZ_ellwAV-zE-eyxanU',
});

cloudinary.api.resource('atpvv1z6vyft1guhekdj', { resource_type: 'video' })
.then(result => {
  console.log('\u2705 Video found in Cloudinary!');
  console.log('URL:', result.secure_url);
})
.catch(error => {
  console.error('\u274C Cannot find video:', error);
});
