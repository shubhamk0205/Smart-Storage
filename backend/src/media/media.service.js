import storageService from './storage.js';
import mediaModel from './media.model.js';
import metadataService from './metadata.js';
import fileTypeService from '../services/file-type.service.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

class MediaService {
  /**
   * Process staging file as media asset
   */
  async processStagingFile(stagingFile, destinationKey = null) {
    try {
      // Detect file type
      const fileTypeInfo = await fileTypeService.detectFromFile(stagingFile.filePath);
      
      // Extract metadata
      const metadata = await metadataService.extractMetadata(
        stagingFile.filePath,
        fileTypeInfo.category
      );

      // Upload to Cloudinary
      const cloudinaryResult = await storageService.uploadToCloudinary(
        stagingFile.filePath,
        storageService.getCloudinaryResourceType(fileTypeInfo.category)
      );

      // Create media asset record
      const ext = path.extname(stagingFile.originalFilename).slice(1) || fileTypeInfo.ext;
      await mediaModel.createTableIfNotExists(ext, fileTypeInfo.mime);

      const mediaRecord = await mediaModel.insertMedia(ext, {
        originalFilename: stagingFile.originalFilename,
        cloudinaryUrl: cloudinaryResult.url,
        cloudinaryPublicId: cloudinaryResult.publicId,
        mimeType: fileTypeInfo.mime,
        extension: ext,
        fileSize: stagingFile.size,
        width: metadata.width || cloudinaryResult.width,
        height: metadata.height || cloudinaryResult.height,
        duration: metadata.duration || cloudinaryResult.duration,
        metadata: {
          ...metadata,
          rawExif: metadata.exif || null,
          sha256: stagingFile.sha256, // Store SHA256 for tracking
        },
      });

      return {
        id: mediaRecord.id,
        stagingId: stagingFile.id,
        destinationKey: destinationKey || cloudinaryResult.publicId,
        publicUrl: cloudinaryResult.url,
        sizeBytes: stagingFile.size,
        sha256: stagingFile.sha256,
        width: mediaRecord.width,
        height: mediaRecord.height,
        duration: mediaRecord.duration,
        rawExif: typeof mediaRecord.metadata === 'string' 
          ? JSON.parse(mediaRecord.metadata)?.rawExif 
          : mediaRecord.metadata?.rawExif,
        mimeType: fileTypeInfo.mime,
        originalFilename: stagingFile.originalFilename,
        createdAt: mediaRecord.created_at,
      };
    } catch (error) {
      logger.error('Error processing media:', error);
      throw error;
    }
  }

  /**
   * Get all media assets
   */
  async getAllMediaAssets(filters = {}) {
    try {
      // Get all media types
      const mediaTypes = await mediaModel.getAllMediaTypes();
      const allAssets = [];

      for (const ext of mediaTypes) {
        const assets = await mediaModel.getMediaByType(ext, 1000, 0);
        allAssets.push(...assets.map(a => this.formatMediaAsset(a, ext)));
      }

      // Apply filters
      let filtered = allAssets;
      if (filters.mime_type) {
        filtered = filtered.filter(a => a.mimeType === filters.mime_type);
      }
      if (filters.original_filename) {
        filtered = filtered.filter(a => 
          a.originalFilename.toLowerCase().includes(filters.original_filename.toLowerCase())
        );
      }
      if (filters.sha256) {
        filtered = filtered.filter(a => a.sha256 === filters.sha256);
      }

      return filtered.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    } catch (error) {
      logger.error('Error getting media assets:', error);
      throw error;
    }
  }

  /**
   * Get media asset by ID
   */
  async getMediaAssetById(id) {
    try {
      const mediaTypes = await mediaModel.getAllMediaTypes();
      
      for (const ext of mediaTypes) {
        const assets = await mediaModel.getMediaByType(ext, 1000, 0);
        const asset = assets.find(a => a.id === id);
        if (asset) {
          return this.formatMediaAsset(asset, ext);
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting media asset:', error);
      throw error;
    }
  }

  /**
   * Format media asset for API response
   */
  formatMediaAsset(record, ext) {
    const metadata = typeof record.metadata === 'string' 
      ? JSON.parse(record.metadata) 
      : record.metadata || {};

    return {
      id: record.id,
      destinationKey: record.cloudinary_public_id,
      publicUrl: record.cloudinary_url,
      sizeBytes: record.file_size,
      sha256: metadata.sha256 || null,
      width: record.width,
      height: record.height,
      duration: record.duration,
      rawExif: metadata.rawExif || null,
      mimeType: record.mime_type,
      originalFilename: record.original_filename,
      createdAt: record.created_at,
    };
  }
}

export default new MediaService();

