import fileTypeService from '../services/file-type.service.js';
import logger from '../utils/logger.js';

class DetectionService {
  /**
   * Detect and classify file
   * @param {string} filePath - Path to the file
   * @param {string} originalFilename - Optional original filename for better detection
   */
  async detectAndClassify(filePath, originalFilename = null) {
    try {
      const fileTypeInfo = await fileTypeService.detectFromFile(filePath, originalFilename);
      
      return {
        mimeType: fileTypeInfo.mime,
        fileKind: fileTypeInfo.category || 'unknown',
      };
    } catch (error) {
      logger.error('Error in detection:', error);
      throw error;
    }
  }
}

export default new DetectionService();

