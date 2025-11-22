import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import { normalizeUploadResult, type NormalizedUploadResult } from "../lib/uppyAdapter";
// @ts-ignore - Some @uppy/react versions don't export DashboardModal in the typings but runtime may provide it
import { DashboardModal } from "@uppy/react";
import XHRUpload from "@uppy/xhr-upload";
import { Button } from "./ui/button";

interface CloudinaryUploadParams {
  uploadUrl: string;
  uploadPreset?: string;
  signature?: string;
  timestamp?: number;
  apiKey?: string;
  folder?: string;
  fields?: { [key: string]: string };
}

interface CloudinaryUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<CloudinaryUploadParams>;
  onComplete?: (result: NormalizedUploadResult) => void;
  buttonClassName?: string;
  children: ReactNode;
  allowedFileTypes?: string[];
}

export function CloudinaryUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 524288000, // 500MB for videos
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  allowedFileTypes = ['video/*', 'image/*'],
}: CloudinaryUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: allowedFileTypes.length > 0 ? allowedFileTypes : undefined,
      },
      autoProceed: false,
    }).use(XHRUpload, {
      endpoint: "placeholder", // Will be updated before upload
      method: "PUT", // GCS uses PUT for signed URLs
      formData: false, // GCS expects raw file data, not multipart form
      fieldName: "file",
      responseType: "text",
      getResponseData: (xhr: XMLHttpRequest) => {
        // GCS returns empty body on success, construct response from request
        const uploadUrl = xhr.responseURL || "";
        // Extract the file path from the signed URL (before query params)
        const url = uploadUrl.split('?')[0];
        const pathParts = url.split('/').filter(p => p);
        const bucket = pathParts[pathParts.length - 2] || '';
        const filePath = pathParts.slice(pathParts.indexOf(bucket) + 1).join('/');

        return {
          public_id: filePath,
          secure_url: url.split('?')[0],
          url: url.split('?')[0],
          uploadURL: url.split('?')[0],
        };
      },
    })
  );

  useEffect(() => {
    const handleComplete = (result: UploadResult<any, any>) => {
      const failed = result.failed ?? [];
      const successful = result.successful ?? [];

      if (failed.length > 0 && successful.length === 0) {
        uppy.info("Upload failed. Please try again.", "error", 5000);
        return;
      }

      if (successful.length > 0) {
        setShowModal(false);
  onComplete?.(normalizeUploadResult(result as UploadResult<any, any>));
        // Some Uppy versions don't expose reset on the type; cast to any for runtime call
        (uppy as any).reset?.();
      }
    };

  const handleUploadError = (file: UppyFile<any, any> | any, error: Error) => {
      console.error("Upload error", error, file);
      uppy.info("Upload failed. Please try again.", "error", 5000);
    };

  // cast handlers when registering with Uppy to avoid strict generic mismatch in event signatures
  uppy.on("complete", handleComplete as any);
  uppy.on("upload-error", handleUploadError as any);

    return () => {
      uppy.off("complete", handleComplete as any);
      uppy.off("upload-error", handleUploadError as any);
    };
  }, [onComplete, uppy]);

  useEffect(() => {
    const prepareUpload = async (fileIDs: string[]) => {
      await Promise.all(
        fileIDs.map(async (fileID) => {
          const file = uppy.getFile(fileID) as UppyFile<any, any> | undefined;

          if (!file) {
            return;
          }

          try {
            const params = await onGetUploadParameters();
            const xhrUpload = uppy.getPlugin<any>("XHRUpload") as any | undefined;

            if (xhrUpload) {
              try {
                xhrUpload.setOptions({
                  endpoint: params.uploadUrl,
                  method: "PUT",
                  formData: false,
                });
              } catch (e) {
                // ignore setOptions typing/runtime mismatches
              }
            }

            // For GCS, we use PUT with the file directly in the body
            const xhrOptions = {
              ...(file.xhrUpload ?? {}),
              endpoint: params.uploadUrl,
              method: "PUT",
              formData: false,
              headers: {
                'Content-Type': file.type || 'application/octet-stream',
              },
            };

            // setFileState XHR options can be typed differently across Uppy versions — cast to any
            uppy.setFileState(fileID, {
              xhrUpload: xhrOptions,
            } as any);

            // Store metadata for later use but don't send to GCS
            // (GCS signed URLs don't accept form fields, the URL itself contains all auth)
            const meta: Record<string, string> = {};
            if (params.folder) {
              meta.folder = params.folder;
            }
            if (params.fields) {
              Object.assign(meta, params.fields);
            }

            uppy.setFileMeta(fileID, meta);
          } catch (error) {
            console.error("Failed to prepare GCS upload", error);
            uppy.info("Failed to prepare upload. Please try again.", "error", 5000);
            uppy.removeFile(fileID);
          }
        })
      );
    };

    uppy.addPreProcessor(prepareUpload);

    return () => {
      uppy.removePreProcessor(prepareUpload);
    };
  }, [onGetUploadParameters, uppy]);

  useEffect(() => {
    return () => {
      // Some Uppy versions expect close() without args; cast to any to be safe
      try {
        (uppy as any).close?.({ reason: "unmount" });
      } catch {
        try { (uppy as any).close?.(); } catch {}
      }
    };
  }, [uppy]);

  return (
    <div>
      <Button
        onClick={() => setShowModal(true)}
        className={buttonClassName}
        data-testid="button-upload"
        type="button"
      >
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}
