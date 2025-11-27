import { Storage } from '@google-cloud/storage';
import { Response } from "express";
import { randomUUID } from "crypto";
import * as path from "path";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Configure Google Cloud Storage
let storage: Storage;
try {
  // Option 1: Use credentials from JSON string (best for production/Render)
  const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson);
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
      credentials,
    });
    console.log('[GCS] ✓ Initialized with credentials from GOOGLE_CLOUD_CREDENTIALS_JSON');
  }
  // Option 2: Use key file path (for local development)
  else if (process.env.GOOGLE_CLOUD_KEYFILE) {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEYFILE,
    });
    console.log('[GCS] ✓ Initialized with key file from GOOGLE_CLOUD_KEYFILE');
  }
  // Option 3: Fallback to default credentials (useful for GCP environments)
  else {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    console.log('[GCS] ⚠️  Initialized with default credentials (may fail if not in GCP environment)');
  }
} catch (error) {
  console.error('[GCS] ❌ Error initializing Google Cloud Storage:', error);
  throw error;
}

const BUCKET_NAME = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'myapp-media-affiliate';

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getStorageFolder(): string {
    return process.env.GCS_FOLDER || "affiliatexchange/videos";
  }

  private getBucket() {
    return storage.bucket(BUCKET_NAME);
  }

  private getContentType(fileName: string, resourceType: string = 'auto'): string {
    const ext = path.extname(fileName).toLowerCase();

    // If resourceType is explicitly set, use it
    if (resourceType === 'video') {
      const videoTypes: { [key: string]: string } = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
      };
      return videoTypes[ext] || 'video/mp4';
    }

    if (resourceType === 'image') {
      const imageTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      };
      return imageTypes[ext] || 'image/jpeg';
    }

    // Auto-detect based on extension
    const types: { [key: string]: string } = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return types[ext] || 'application/octet-stream';
  }

  async getObjectEntityUploadURL(customFolder?: string, resourceType: string = 'auto', clientContentType?: string, originalFileName?: string): Promise<{
    uploadUrl: string;
    uploadPreset?: string;
    signature?: string;
    timestamp?: number;
    apiKey?: string;
    folder?: string;
    contentType?: string;
    fields?: { [key: string]: string };
  }> {
    const folder = customFolder || this.getStorageFolder();

    // Generate filename with appropriate extension based on resource type or original filename
    let fileExtension = '';
    if (originalFileName) {
      // Preserve the original file extension
      fileExtension = path.extname(originalFileName).toLowerCase();
    } else if (resourceType === 'image') {
      fileExtension = '.jpg'; // Thumbnails are generated as JPEG
    } else if (resourceType === 'video') {
      fileExtension = '.mp4'; // Default video extension
    }

    const fileName = `${randomUUID()}${fileExtension}`;
    const filePath = `${folder}/${fileName}`;

    const bucket = this.getBucket();
    const file = bucket.file(filePath);

    // Use client-provided content type if available, otherwise detect from filename
    const contentType = clientContentType || this.getContentType(fileName, resourceType);

    // Generate signed URL for upload (valid for 15 minutes)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    console.log('[ObjectStorage] Generated GCS signed upload URL for folder:', folder, 'resourceType:', resourceType, 'contentType:', contentType, 'extension:', fileExtension);

    return {
      uploadUrl: signedUrl,
      folder,
      contentType, // Return the content type so frontend uses the exact same one
      fields: {
        key: filePath,
        bucket: BUCKET_NAME,
      },
    };
  }

  async uploadFile(
    filePath: string,
    options?: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
    }
  ): Promise<any> {
    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || path.basename(filePath);
    const destination = `${folder}/${fileName}`;

    const bucket = this.getBucket();
    await bucket.upload(filePath, {
      destination,
      metadata: {
        contentType: this.getContentType(filePath, options?.resourceType || 'auto'),
      },
    });

    const file = bucket.file(destination);
    const [metadata] = await file.getMetadata();

    return {
      public_id: destination,
      secure_url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
      url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
      resource_type: options?.resourceType || 'auto',
      format: path.extname(fileName).substring(1),
      ...metadata,
    };
  }

  async uploadBuffer(
    buffer: Buffer,
    options?: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
    }
  ): Promise<any> {
    const folder = options?.folder || this.getStorageFolder();
    const fileName = options?.publicId || randomUUID();
    const destination = `${folder}/${fileName}`;

    const bucket = this.getBucket();
    const file = bucket.file(destination);

    await file.save(buffer, {
      metadata: {
        contentType: this.getContentType(fileName, options?.resourceType || 'auto'),
      },
    });

    const [metadata] = await file.getMetadata();

    return {
      public_id: destination,
      secure_url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
      url: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
      resource_type: options?.resourceType || 'auto',
      format: path.extname(fileName).substring(1),
      ...metadata,
    };
  }

  getVideoUrl(
    publicId: string,
    options?: {
      quality?: string;
      format?: string;
      transformation?: any[];
    }
  ): string {
    // GCS doesn't have built-in transformations like Cloudinary
    // Return the direct URL to the video
    return `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`;
  }

  getVideoThumbnail(publicId: string): string {
    // GCS doesn't auto-generate video thumbnails like Cloudinary
    // You could either:
    // 1. Store thumbnails separately when uploading
    // 2. Use a video thumbnail service
    // 3. Return a placeholder or the video URL itself
    // For now, returning the video URL (browsers can show first frame)
    return `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`;
  }

  async downloadObject(
    publicId: string,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      const folder = this.getStorageFolder();
      const bucket = this.getBucket();

      // Try with folder prefix first
      let file = bucket.file(`${folder}/${publicId}`);
      let exists = await file.exists();

      // If not found, try without folder prefix
      if (!exists[0]) {
        file = bucket.file(publicId);
        exists = await file.exists();
      }

      if (!exists[0]) {
        throw new ObjectNotFoundError();
      }

      // Generate a signed URL for temporary access
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + cacheTtlSec * 1000,
      });

      res.redirect(signedUrl);
    } catch (error) {
      console.error("Error getting video URL:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async deleteVideo(publicId: string): Promise<any> {
    return await this.deleteResource(publicId, 'video');
  }

  async deleteImage(publicId: string): Promise<any> {
    return await this.deleteResource(publicId, 'image');
  }

  async deleteResource(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<any> {
    const bucket = this.getBucket();
    const file = bucket.file(publicId);

    try {
      await file.delete();
      return { result: 'ok' };
    } catch (error: any) {
      if (error.code === 404) {
        return { result: 'not found' };
      }
      throw error;
    }
  }

  async deleteFolder(folderPath: string): Promise<any> {
    try {
      const bucket = this.getBucket();

      // List all files in the folder
      const [files] = await bucket.getFiles({
        prefix: folderPath,
      });

      // Delete all files
      await Promise.all(files.map(file => file.delete()));

      console.info(`[ObjectStorage] Deleted ${files.length} files from folder ${folderPath}`);

      return { deleted: files.length };
    } catch (error) {
      const message = (error as any)?.message || JSON.stringify(error);
      throw new Error(message);
    }
  }

  async getVideoInfo(publicId: string): Promise<any> {
    const bucket = this.getBucket();
    const file = bucket.file(publicId);

    try {
      const [metadata] = await file.getMetadata();
      const [exists] = await file.exists();

      if (!exists) {
        throw new ObjectNotFoundError();
      }

      return {
        public_id: publicId,
        format: path.extname(publicId).substring(1),
        resource_type: metadata.contentType?.startsWith('video/') ? 'video' :
                       metadata.contentType?.startsWith('image/') ? 'image' : 'raw',
        bytes: metadata.size,
        url: `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`,
        secure_url: `https://storage.googleapis.com/${BUCKET_NAME}/${publicId}`,
        created_at: metadata.timeCreated,
        ...metadata,
      };
    } catch (error: any) {
      if (error.code === 404 || error instanceof ObjectNotFoundError) {
        throw new ObjectNotFoundError();
      }
      throw error;
    }
  }

  async searchPublicObject(filePath: string): Promise<any | null> {
    try {
      const info = await this.getVideoInfo(filePath);
      return info;
    } catch (error) {
      return null;
    }
  }

  async getObjectEntityFile(objectPath: string): Promise<any> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const publicId = objectPath.replace("/objects/", "");

    const folder = this.getStorageFolder();
    const fullPublicId = `${folder}/${publicId}`;

    try {
      const info = await this.getVideoInfo(fullPublicId);
      return info;
    } catch (error) {
      try {
        const info = await this.getVideoInfo(publicId);
        return info;
      } catch (fallbackError) {
        throw new ObjectNotFoundError();
      }
    }
  }

  extractPublicIdFromUrl(gcsUrl: string): string | null {
    try {
      // Handle GCS URLs: https://storage.googleapis.com/bucket-name/path/to/file.ext
      if (!gcsUrl.startsWith("https://storage.googleapis.com/")) {
        return null;
      }

      const url = new URL(gcsUrl);
      const pathParts = url.pathname.split('/').filter(p => p);

      // First part is bucket name, rest is the file path
      if (pathParts.length < 2) return null;

      // Remove bucket name, keep the rest as public ID
      const publicIdWithExt = pathParts.slice(1).join('/');

      // Remove extension from last part
      const lastDotIndex = publicIdWithExt.lastIndexOf('.');
      const publicId = lastDotIndex > 0 ? publicIdWithExt.substring(0, lastDotIndex) : publicIdWithExt;

      return publicId;
    } catch (error) {
      console.error('[extractPublicIdFromUrl] Error parsing URL:', error);
      return null;
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      const url = new URL(rawPath);
      const pathParts = url.pathname.split('/').filter(p => p);

      // Remove bucket name and get file path
      if (pathParts.length < 2) return rawPath;

      const filePath = pathParts.slice(1).join('/');
      const fileName = pathParts[pathParts.length - 1];
      const publicId = fileName.split('.')[0];

      return '/objects/' + publicId;
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: any;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return true;
  }

  getPublicObjectSearchPaths(): Array<string> {
    return [this.getStorageFolder()];
  }

  getPrivateObjectDir(): string {
    return this.getStorageFolder();
  }
}