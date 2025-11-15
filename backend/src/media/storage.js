import cloudinary from '../config/cloudinary.config.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

class StorageService {
  /**
   * Upload file to Cloudinary
   * @param {string} filePath - Local file path
   * @param {string} resourceType - Resource type (image, video, raw)
   * @param {string} folder - Cloudinary folder name
   * @returns {Promise<Object>} Upload result with URL and public_id
   */
  async uploadToCloudinary(filePath, resourceType = 'auto', folder = 'smart-storage') {
    try {
      logger.info(`Uploading file to Cloudinary: ${filePath}`);

      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: resourceType,
        folder: folder,
      });

      logger.info(`File uploaded successfully to Cloudinary: ${result.secure_url}`);

      // Clean up local file after successful upload
      await this.deleteLocalFile(filePath);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        duration: result.duration, // For videos
      };
    } catch (error) {
      logger.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Delete local file
   * @param {string} filePath - Path to the file
   */
  async deleteLocalFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info(`Local file deleted: ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to delete local file: ${filePath}`, error);
    }
  }

  /**
   * Determine Cloudinary resource type based on media category
   * @param {string} category - Media category (image, video, audio)
   * @returns {string} Cloudinary resource type
   */
  getCloudinaryResourceType(category) {
    switch (category) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'audio':
        return 'video'; // Cloudinary uses 'video' for audio files
      default:
        return 'auto';
    }
  }
}

export default new StorageService();
