import db from '../config/knex.js';
import logger from '../utils/logger.js';

class MediaModel {
  /**
   * Get table name based on media extension
   * @param {string} ext - File extension (jpg, png, mp4, etc.)
   * @returns {string} Table name
   */
  getTableName(ext) {
    // Normalize extension to lowercase and remove dots
    const normalizedExt = ext.toLowerCase().replace('.', '');
    return `media_${normalizedExt}`;
  }

  /**
   * Check if table exists for the given extension
   * @param {string} ext - File extension
   * @returns {Promise<boolean>} True if table exists
   */
  async tableExists(ext) {
    try {
      const tableName = this.getTableName(ext);
      const exists = await db.schema.hasTable(tableName);
      return exists;
    } catch (error) {
      logger.error(`Error checking if table exists for ${ext}:`, error);
      throw error;
    }
  }

  /**
   * Create table for the given extension if it doesn't exist
   * @param {string} ext - File extension
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<void>}
   */
  async createTableIfNotExists(ext, mimeType) {
    try {
      const tableName = this.getTableName(ext);
      const exists = await this.tableExists(ext);

      if (!exists) {
        logger.info(`Creating new table: ${tableName}`);

        await db.schema.createTable(tableName, (table) => {
          table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
          table.string('original_filename', 500).notNullable();
          table.string('cloudinary_url', 1000).notNullable();
          table.string('cloudinary_public_id', 500).notNullable();
          table.string('mime_type', 100).notNullable();
          table.string('extension', 50).notNullable();
          table.bigInteger('file_size').notNullable(); // Size in bytes

          // Media-specific metadata
          table.integer('width').nullable(); // For images and videos
          table.integer('height').nullable(); // For images and videos
          table.float('duration').nullable(); // For videos and audio
          table.jsonb('metadata').nullable(); // Additional metadata

          // Timestamps
          table.timestamp('created_at').defaultTo(db.fn.now());
          table.timestamp('updated_at').defaultTo(db.fn.now());

          // Indexes
          table.index('extension');
          table.index('mime_type');
          table.index('created_at');
        });

        logger.info(`Table ${tableName} created successfully`);
      } else {
        logger.info(`Table ${tableName} already exists`);
      }
    } catch (error) {
      logger.error(`Error creating table for ${ext}:`, error);
      throw error;
    }
  }

  /**
   * Insert media record into the appropriate table
   * @param {string} ext - File extension
   * @param {Object} data - Media data to insert
   * @returns {Promise<Object>} Inserted record
   */
  async insertMedia(ext, data) {
    try {
      const tableName = this.getTableName(ext);

      const [record] = await db(tableName)
        .insert({
          original_filename: data.originalFilename,
          cloudinary_url: data.cloudinaryUrl,
          cloudinary_public_id: data.cloudinaryPublicId,
          mime_type: data.mimeType,
          extension: data.extension,
          file_size: data.fileSize,
          width: data.width || null,
          height: data.height || null,
          duration: data.duration || null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        })
        .returning('*');

      logger.info(`Media record inserted into ${tableName} with id: ${record.id}`);

      return record;
    } catch (error) {
      logger.error(`Error inserting media into ${ext} table:`, error);
      throw error;
    }
  }

  /**
   * Get all records from a specific media type table
   * @param {string} ext - File extension
   * @param {number} limit - Number of records to fetch
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} Array of media records
   */
  async getMediaByType(ext, limit = 50, offset = 0) {
    try {
      const tableName = this.getTableName(ext);
      const exists = await this.tableExists(ext);

      if (!exists) {
        return [];
      }

      const records = await db(tableName)
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return records;
    } catch (error) {
      logger.error(`Error fetching media from ${ext} table:`, error);
      throw error;
    }
  }

  /**
   * Get all media types (tables) that exist
   * @returns {Promise<Array>} Array of media types (extensions)
   */
  async getAllMediaTypes() {
    try {
      // Query to get all tables that start with 'media_'
      const tables = await db.raw(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'media_%'
      `);

      const mediaTypes = tables.rows.map(row => {
        // Extract extension from table name (e.g., 'media_jpg' -> 'jpg')
        return row.table_name.replace('media_', '');
      });

      return mediaTypes;
    } catch (error) {
      logger.error('Error fetching all media types:', error);
      throw error;
    }
  }

  /**
   * Delete a media record
   * @param {string} ext - File extension
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteMedia(ext, id) {
    try {
      const tableName = this.getTableName(ext);
      const deleted = await db(tableName).where('id', id).del();

      if (deleted) {
        logger.info(`Media record deleted from ${tableName}: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting media from ${ext} table:`, error);
      throw error;
    }
  }
}

export default new MediaModel();
