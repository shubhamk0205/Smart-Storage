import fileTypeService from './file-type.service.js';
import storageService from '../media/storage.js';
import mediaModel from '../media/media.model.js';
import logger from '../utils/logger.js';
import path from 'path';

class MediaPipelineService {
  /**
   * Process media file
   * 1. Detect specific file type (jpg, png, mp4, etc.)
   * 2. Create table for this type if it doesn't exist
   * 3. Upload to Cloudinary
   * 4. Save metadata and URL to PostgreSQL table
   * @param {string} filePath - Path to the uploaded file
   * @param {string} originalFilename - Original filename
   * @returns {Promise<Object>} Processing results
   */
  async processMedia(filePath, originalFilename) {
    try {
      logger.info(`Processing media file: ${originalFilename}`);

      // Step 1: Detect specific file type using file-type library
      const fileTypeInfo = await fileTypeService.detectFromFile(filePath);
      const { mime: mimeType, ext, category } = fileTypeInfo;

      logger.info(`Detected file type - MIME: ${mimeType}, Extension: ${ext}, Category: ${category}`);

      // Step 2: Create table for this extension if it doesn't exist
      await mediaModel.createTableIfNotExists(ext, mimeType);

      // Step 3: Upload to Cloudinary
      const resourceType = storageService.getCloudinaryResourceType(category);
      const cloudinaryResult = await storageService.uploadToCloudinary(
        filePath,
        resourceType,
        `smart-storage/${category}`
      );

      // Step 4: Save metadata to PostgreSQL table
      const mediaData = {
        originalFilename: originalFilename,
        cloudinaryUrl: cloudinaryResult.url,
        cloudinaryPublicId: cloudinaryResult.publicId,
        mimeType: mimeType,
        extension: ext,
        fileSize: cloudinaryResult.bytes,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        duration: cloudinaryResult.duration,
        metadata: {
          format: cloudinaryResult.format,
          resourceType: cloudinaryResult.resourceType,
        },
      };

      const record = await mediaModel.insertMedia(ext, mediaData);

      logger.info(`Media processing complete for ${originalFilename}`);

      return {
        success: true,
        message: 'Media processed successfully',
        data: {
          id: record.id,
          tableName: mediaModel.getTableName(ext),
          extension: ext,
          mimeType: mimeType,
          category: category,
          cloudinaryUrl: cloudinaryResult.url,
          fileSize: cloudinaryResult.bytes,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          duration: cloudinaryResult.duration,
          createdAt: record.created_at,
        },
      };
    } catch (error) {
      logger.error('Error processing media:', error);
      throw error;
    }
  }

  /**
   * Get all media types that have been stored
   * @returns {Promise<Array>} Array of media types
   */
  async getAllMediaTypes() {
    try {
      return await mediaModel.getAllMediaTypes();
    } catch (error) {
      logger.error('Error fetching all media types:', error);
      throw error;
    }
  }

  /**
   * Get media files by type
   * @param {string} ext - File extension
   * @param {number} limit - Number of records
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} Array of media records
   */
  async getMediaByType(ext, limit = 50, offset = 0) {
    try {
      return await mediaModel.getMediaByType(ext, limit, offset);
    } catch (error) {
      logger.error(`Error fetching media by type ${ext}:`, error);
      throw error;
    }
  }
}

export default new MediaPipelineService();
