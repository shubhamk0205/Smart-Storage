import fileTypeService from '../services/file-type.service.js';
import mediaPipelineService from '../services/media-pipeline.service.js';
import jsonPipelineService from '../services/json-pipeline.service.js';
import logger from '../utils/logger.js';

/**
 * Process multiple uploaded files
 * Detects file types and routes to appropriate pipelines
 * @param {Array} files - Array of uploaded files from multer
 * @returns {Promise<Array>} Array of processing results
 */
export const processFiles = async (files) => {
  try {
    const results = [];

    // Process each file
    for (const file of files) {
      try {
        const result = await processSingleFile(file);
        results.push(result);
      } catch (error) {
        logger.error(`Error processing file ${file.originalname}:`, error);
        results.push({
          filename: file.originalname,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error in processFiles:', error);
    throw error;
  }
};

/**
 * Process a single file
 * Detects file type and routes to appropriate pipeline
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Processing result
 */
const processSingleFile = async (file) => {
  try {
    logger.info(`Processing file: ${file.originalname}`);

    // Detect file type using file-type library
    const fileTypeInfo = await fileTypeService.detectFromFile(file.path);

    logger.info(`Detected file type: ${fileTypeInfo.mime}, category: ${fileTypeInfo.category}`);

    // Route to appropriate pipeline based on category
    let pipelineResult;

    if (isMediaCategory(fileTypeInfo.category)) {
      // Route to media pipeline
      pipelineResult = await routeToMediaPipeline(file, fileTypeInfo);
    } else if (fileTypeInfo.category === 'json') {
      // Route to JSON pipeline
      pipelineResult = await routeToJsonPipeline(file, fileTypeInfo);
    } else {
      // Unknown or unsupported category
      logger.warn(`Unsupported file category: ${fileTypeInfo.category}`);
      pipelineResult = {
        processed: false,
        message: `Unsupported file category: ${fileTypeInfo.category}`,
      };
    }

    return {
      filename: file.originalname,
      success: true,
      fileType: fileTypeInfo,
      pipeline: isMediaCategory(fileTypeInfo.category) ? 'media' : fileTypeInfo.category,
      result: pipelineResult,
    };
  } catch (error) {
    logger.error(`Error in processSingleFile for ${file.originalname}:`, error);
    throw error;
  }
};

/**
 * Check if category is a media type
 * @param {string} category - File category
 * @returns {boolean} True if media category
 */
const isMediaCategory = (category) => {
  return ['image', 'video', 'audio'].includes(category);
};

/**
 * Route file to media pipeline
 * @param {Object} file - Multer file object
 * @param {Object} fileTypeInfo - File type information
 * @returns {Promise<Object>} Media pipeline result
 */
const routeToMediaPipeline = async (file, fileTypeInfo) => {
  try {
    logger.info(`Routing ${file.originalname} to media pipeline`);

    // Process media file
    const mediaResult = await mediaPipelineService.processMedia(
      file.path,
      file.originalname
    );

    return {
      ...mediaResult,
      filePath: file.path,
      fileSize: file.size,
      mimeType: fileTypeInfo.mime,
      extension: fileTypeInfo.ext,
    };
  } catch (error) {
    logger.error('Error in media pipeline:', error);
    throw error;
  }
};

/**
 * Route file to JSON pipeline
 * @param {Object} file - Multer file object
 * @param {Object} fileTypeInfo - File type information
 * @returns {Promise<Object>} JSON pipeline result
 */
const routeToJsonPipeline = async (file, fileTypeInfo) => {
  try {
    logger.info(`Routing ${file.originalname} to JSON pipeline`);

    // Process JSON file
    const jsonResult = await jsonPipelineService.processJson(
      file.path,
      fileTypeInfo.ext
    );

    return {
      ...jsonResult,
      filePath: file.path,
      fileSize: file.size,
      mimeType: fileTypeInfo.mime,
      extension: fileTypeInfo.ext,
    };
  } catch (error) {
    logger.error('Error in JSON pipeline:', error);
    throw error;
  }
};
