import { v2 as cloudinary } from 'cloudinary';
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getCloudinaryFolder(): string {
    return process.env.CLOUDINARY_FOLDER || "affiliatexchange/videos";
  }

  getCloudinaryUploadPreset(): string {
    return process.env.CLOUDINARY_UPLOAD_PRESET || "";
  }

  async getObjectEntityUploadURL(customFolder?: string, resourceType: string = 'auto'): Promise<{
    uploadUrl: string;
    uploadPreset?: string;
    signature?: string;
    timestamp?: number;
    apiKey?: string;
    folder?: string;
  }> {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = customFolder || this.getCloudinaryFolder();
    const uploadPreset = this.getCloudinaryUploadPreset();

    // Construct the upload URL with the correct resource type
    const baseUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}`;
    const uploadUrl = `${baseUrl}/${resourceType}/upload`;

    // Build params to sign - do NOT include resource_type when it's in the URL path
    const paramsToSign: any = {
      timestamp,
      folder,
    };

    // If a custom folder is specified, use signed upload instead of preset
    // This ensures the folder parameter is respected and not overridden by preset config
    if (customFolder) {
      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET || ""
      );

      console.log('[ObjectStorage] Using SIGNED upload for custom folder:', folder, 'resourceType:', resourceType);
      return {
        uploadUrl,
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder,
      };
    }

    // Use upload preset for default uploads (offers)
    if (uploadPreset) {
      console.log('[ObjectStorage] Using PRESET upload for default folder:', folder, 'resourceType:', resourceType);
      return {
        uploadUrl,
        uploadPreset,
        folder,
      };
    }

    // Fallback to signed upload if no preset is configured
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ""
    );

    console.log('[ObjectStorage] Using SIGNED upload (no preset):', folder, 'resourceType:', resourceType);
    return {
      uploadUrl,
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
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
    const uploadOptions = {
      folder: options?.folder || this.getCloudinaryFolder(),
      resource_type: options?.resourceType || 'auto',
      public_id: options?.publicId,
    };

    return await cloudinary.uploader.upload(filePath, uploadOptions);
  }

  async uploadBuffer(
    buffer: Buffer,
    options?: {
      folder?: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      publicId?: string;
    }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options?.folder || this.getCloudinaryFolder(),
          resource_type: options?.resourceType || 'auto',
          public_id: options?.publicId,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      uploadStream.end(buffer);
    });
  }

  getVideoUrl(
    publicId: string,
    options?: {
      quality?: string;
      format?: string;
      transformation?: any[];
    }
  ): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      quality: options?.quality || 'auto',
      format: options?.format,
      transformation: options?.transformation,
    });
  }

  getVideoThumbnail(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 400, height: 300, crop: 'fill' },
        { quality: 'auto' },
      ],
    });
  }

  async downloadObject(
    publicId: string,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      const folder = this.getCloudinaryFolder();
      let videoUrl;
      
      try {
        videoUrl = cloudinary.url(folder + '/' + publicId, {
          resource_type: 'video',
          secure: true,
        });
      } catch (error) {
        videoUrl = cloudinary.url(publicId, {
          resource_type: 'video',
          secure: true,
        });
      }

      res.redirect(videoUrl);
    } catch (error) {
      console.error("Error getting video URL:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async deleteVideo(publicId: string): Promise<any> {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });
  }

  async deleteImage(publicId: string): Promise<any> {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });
  }

  async deleteResource(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<any> {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }

  async deleteFolder(folderPath: string): Promise<any> {
    try {
      // Delete all resources in the folder for each resource type we store
      const deleteByType = async (resourceType: 'image' | 'video' | 'raw') =>
        cloudinary.api.delete_resources_by_prefix(folderPath, {
          resource_type: resourceType,
          type: 'upload'
        });

      const [imageResult] = await Promise.all([
        deleteByType('image'),
        deleteByType('video'),
        deleteByType('raw')
      ]);

      // Finally delete the folder itself. If it's already gone, ignore the error.
      try {
        await cloudinary.api.delete_folder(folderPath);
      } catch (folderError: any) {
        const message = folderError?.message || folderError?.error?.message || '';
        // Cloudinary returns a not-found/does-not-exist message when the folder is already removed.
        if (/not\s+found|does not exist|can't find folder/i.test(message)) {
          console.info(`[ObjectStorage] Folder ${folderPath} does not exist; skipping deletion.`);
        } else {
          throw folderError;
        }
      }

      return imageResult;
    } catch (error) {
      // Surface richer error details to the caller so the logs are actionable.
      const message = (error as any)?.message || (error as any)?.error?.message || JSON.stringify(error);
      throw new Error(message);
    }
  }

  async getVideoInfo(publicId: string): Promise<any> {
    return await cloudinary.api.resource(publicId, {
      resource_type: 'video',
    });
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
    
    const folder = this.getCloudinaryFolder();
    const fullPublicId = folder + '/' + publicId;

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

  extractPublicIdFromUrl(cloudinaryUrl: string): string | null {
    try {
      if (!cloudinaryUrl.startsWith("https://res.cloudinary.com/")) {
        return null;
      }

      const url = new URL(cloudinaryUrl);
      const pathParts = url.pathname.split('/');

      // Cloudinary URL format: /cloud_name/resource_type/upload/v{version}/folder/filename.ext
      // We need to find the upload index and get everything after version
      const uploadIndex = pathParts.indexOf('upload');
      if (uploadIndex === -1) return null;

      // Get parts after 'upload' and skip the version (vXXXXXXX)
      const afterUpload = pathParts.slice(uploadIndex + 1);
      const versionIndex = afterUpload.findIndex(part => part.startsWith('v') && /^v\d+$/.test(part));
      const relevantParts = versionIndex >= 0 ? afterUpload.slice(versionIndex + 1) : afterUpload;

      if (relevantParts.length === 0) return null;

      // Join folder and filename, remove extension from last part
      const publicIdWithExt = relevantParts.join('/');
      const lastDotIndex = publicIdWithExt.lastIndexOf('.');
      const publicId = lastDotIndex > 0 ? publicIdWithExt.substring(0, lastDotIndex) : publicIdWithExt;

      return publicId;
    } catch (error) {
      console.error('[extractPublicIdFromUrl] Error parsing URL:', error);
      return null;
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("https://res.cloudinary.com/")) {
      const url = new URL(rawPath);
      const pathParts = url.pathname.split('/');
      const publicIdWithExt = pathParts.slice(-1)[0];
      const publicId = publicIdWithExt.split('.')[0];
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
    return [this.getCloudinaryFolder()];
  }

  getPrivateObjectDir(): string {
    return this.getCloudinaryFolder();
  }
}
