import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format?: string;
}

@Injectable()
export class CloudinaryService {
  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    }
  }

  async upload(
    buffer: Buffer,
    folder: string,
    resourceType: 'image' | 'raw' | 'auto' = 'auto',
  ): Promise<CloudinaryUploadResult> {
    this.ensureConfigured();

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error || !result) {
            reject(new InternalServerErrorException('Échec de l’upload Cloudinary.'));
            return;
          }
          resolve(this.mapResult(result));
        },
      );
      stream.end(buffer);
    });
  }

  async delete(publicId: string, resourceType: string = 'image'): Promise<void> {
    this.ensureConfigured();
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new InternalServerErrorException('Échec de la suppression Cloudinary.');
    }
  }

  private ensureConfigured(): void {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new InternalServerErrorException('La configuration Cloudinary est incomplète.');
    }
  }

  private mapResult(result: UploadApiResponse): CloudinaryUploadResult {
    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
    };
  }
}
