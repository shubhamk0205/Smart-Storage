import { fileTypeFromFile, fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

class FileTypeService {
  /**
   * Detect MIME type from file path
   * @param {string} filePath - Path to the file
   * @param {string} originalFilename - Optional original filename (for better extension detection)
   * @returns {Promise<Object>} File type information
   */
  async detectFromFile(filePath, originalFilename = null) {
    try {
      // STEP 1: Check extension from original filename FIRST (most reliable)
      // Uploaded files might have UUID names, so original filename is more accurate
      let extension = '';
      if (originalFilename) {
        extension = this.getFileExtension(originalFilename);
        logger.info(`Checking extension from original filename: ${originalFilename} -> ${extension}`);
      }
      
      // If no extension from original filename, check file path
      if (!extension) {
        extension = this.getFileExtension(filePath);
        logger.info(`Checking extension from file path: ${filePath} -> ${extension}`);
      }
      
      // Try extension-based detection
      const extensionBasedType = await this.detectByExtension(extension, filePath);
      if (extensionBasedType) {
        logger.info(`✅ Detected file type by extension: ${extensionBasedType.mime} (category: ${extensionBasedType.category}) - ${originalFilename || filePath}`);
        return extensionBasedType;
      }

      // Then try magic bytes detection
      const fileType = await fileTypeFromFile(filePath);

      if (!fileType) {
        // If magic bytes fail, try reading file content for text formats
        try {
          const buffer = await fs.readFile(filePath);
          const textType = this.detectTextFormat(buffer);
          if (textType) {
            logger.info(`Detected file type by content: ${textType.mime} (${filePath})`);
            return textType;
          }
        } catch (readError) {
          logger.warn(`Could not read file for content detection: ${filePath}`);
        }

        logger.warn(`Could not detect file type for: ${filePath}`);
        return {
          mime: 'application/octet-stream',
          ext: extension || 'bin',
          category: 'unknown',
        };
      }

      return {
        mime: fileType.mime,
        ext: fileType.ext,
        category: this.categorizeFileType(fileType.mime),
      };
    } catch (error) {
      logger.error('Error detecting file type:', error);
      throw error;
    }
  }

  /**
   * Get file extension from path
   * @param {string} filePath - File path
   * @returns {string} File extension (without dot)
   */
  getFileExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext ? ext.slice(1) : ''; // Remove the dot
  }

  /**
   * Detect file type by extension (for text-based files)
   * @param {string} extension - File extension
   * @param {string} filePath - File path (for reading content if needed)
   * @returns {Object|null} File type information or null
   */
  async detectByExtension(extension, filePath) {
    // JSON files - ALWAYS detect by extension first (most reliable for text files)
    if (extension === 'json') {
      // Always return JSON category if extension is .json
      // Content validation happens later in the pipeline
      return {
        mime: 'application/json',
        ext: 'json',
        category: 'json',
      };
    }

    // NDJSON files
    if (extension === 'ndjson' || extension === 'jsonl') {
      return {
        mime: 'application/x-ndjson',
        ext: 'ndjson',
        category: 'json',
      };
    }

    // CSV files
    if (extension === 'csv') {
      return {
        mime: 'text/csv',
        ext: 'csv',
        category: 'text',
      };
    }

    // Other text files
    if (['txt', 'md', 'log'].includes(extension)) {
      return {
        mime: 'text/plain',
        ext: extension,
        category: 'text',
      };
    }

    return null;
  }

  /**
   * Detect MIME type from buffer
   * @param {Buffer} buffer - File buffer
   * @returns {Promise<Object>} File type information
   */
  async detectFromBuffer(buffer) {
    try {
      const fileType = await fileTypeFromBuffer(buffer);

      if (!fileType) {
        // Try to detect JSON/NDJSON/text formats
        const textType = this.detectTextFormat(buffer);
        if (textType) {
          return textType;
        }

        logger.warn('Could not detect file type from buffer');
        return {
          mime: 'application/octet-stream',
          ext: 'bin',
          category: 'unknown',
        };
      }

      return {
        mime: fileType.mime,
        ext: fileType.ext,
        category: this.categorizeFileType(fileType.mime),
      };
    } catch (error) {
      logger.error('Error detecting file type from buffer:', error);
      throw error;
    }
  }

  /**
   * Detect text-based formats (JSON, NDJSON, CSV, etc.)
   * @param {Buffer} buffer - File buffer
   * @returns {Object|null} File type information or null
   */
  detectTextFormat(buffer) {
    try {
      const text = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));

      // Check for JSON
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
          JSON.parse(text);
          return {
            mime: 'application/json',
            ext: 'json',
            category: 'json',
          };
        } catch (e) {
          // Not valid JSON
        }
      }

      // Check for NDJSON (newline-delimited JSON)
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        let validJsonLines = 0;
        for (const line of lines.slice(0, 5)) {
          try {
            JSON.parse(line);
            validJsonLines++;
          } catch (e) {
            // Not a JSON line
          }
        }
        if (validJsonLines > 0 && validJsonLines === lines.slice(0, 5).length) {
          return {
            mime: 'application/x-ndjson',
            ext: 'ndjson',
            category: 'json',
          };
        }
      }

      // Check for CSV
      if (text.includes(',') && text.split('\n').length > 1) {
        return {
          mime: 'text/csv',
          ext: 'csv',
          category: 'text',
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Categorize file type into broad categories
   * @param {string} mimeType - MIME type
   * @returns {string} Category
   */
  categorizeFileType(mimeType) {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }
    if (mimeType.includes('json') || mimeType.includes('ndjson')) {
      return 'json';
    }
    if (mimeType.startsWith('text/')) {
      return 'text';
    }
    if (mimeType.includes('pdf')) {
      return 'document';
    }
    return 'other';
  }
}

export default new FileTypeService();
