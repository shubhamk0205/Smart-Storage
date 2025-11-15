import fileTypeService from '../services/file-type.service.js';
import logger from '../utils/logger.js';

class DetectionService {
  /**
   * Detect and classify file
   */
  async detectAndClassify(filePath) {
    try {
      const fileTypeInfo = await fileTypeService.detectFromFile(filePath);
      
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

