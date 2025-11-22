export const isCloudinaryHost = (url?: string) => {
  if (!url) return false;
  try {
    const u = new URL(url);
    // Support both Cloudinary (legacy) and GCS
    return u.hostname.endsWith("cloudinary.com") ||
           u.hostname.endsWith("res.cloudinary.com") ||
           u.hostname.endsWith("googleapis.com") ||
           u.hostname.endsWith("storage.googleapis.com");
  } catch (e) {
    return false;
  }
};

export const isVideoUrl = (url?: string) => {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.flv'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('/video/');
};

export const proxiedSrc = (src?: string | null) => {
  if (!src) return src || undefined;

  // Handle legacy normalized paths like /objects/{publicId}
  // Convert them to /public-objects/ for public access (no auth required)
  if (src.startsWith('/objects/')) {
    const publicId = src.replace('/objects/', '');
    // Use the /public-objects/ endpoint which doesn't require authentication
    return `/public-objects/${publicId}`;
  }

  try {
    if (isCloudinaryHost(src)) {
      // For videos, use the video proxy endpoint that supports range requests
      if (isVideoUrl(src)) {
        return `/proxy/video?url=${encodeURIComponent(src)}`;
      }
      // For images, use the image proxy
      return `/proxy/image?url=${encodeURIComponent(src)}`;
    }
  } catch (e) {
    // fallthrough
  }
  return src;
};

export default proxiedSrc;
