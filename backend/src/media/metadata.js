import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { fileTypeFromFile } from 'file-type';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

class MetadataService {
  /**
   * Extract metadata from media file
   */
  async extractMetadata(filePath, category) {
    try {
      const metadata = {
        width: null,
        height: null,
        duration: null,
        exif: null,
      };

      if (category === 'image') {
        const imageMetadata = await sharp(filePath).metadata();
        metadata.width = imageMetadata.width;
        metadata.height = imageMetadata.height;
        
        // EXIF data is included in the metadata object (if available)
        // Sharp's metadata() method returns an object that may contain 'exif' property
        // The 'exif' property is a Buffer containing raw EXIF data
        if (imageMetadata.exif) {
          // Convert Buffer to base64 string for JSON storage, or keep as Buffer
          // For JSON storage, we'll convert to base64
          if (Buffer.isBuffer(imageMetadata.exif)) {
            metadata.exif = {
              raw: imageMetadata.exif.toString('base64'),
              hasExif: true,
            };
          } else {
            metadata.exif = imageMetadata.exif;
          }
        }
        
        // Also store orientation if available (part of EXIF)
        if (imageMetadata.orientation) {
          if (!metadata.exif) {
            metadata.exif = {};
          }
          metadata.exif.orientation = imageMetadata.orientation;
        }
      } else if (category === 'video' || category === 'audio') {
        return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(filePath, (err, probeData) => {
            if (err) {
              logger.warn('Could not extract video/audio metadata:', err);
              resolve(metadata);
              return;
            }

            const videoStream = probeData.streams.find(s => s.codec_type === 'video');
            const audioStream = probeData.streams.find(s => s.codec_type === 'audio');

            if (videoStream) {
              metadata.width = videoStream.width;
              metadata.height = videoStream.height;
            }

            if (probeData.format && probeData.format.duration) {
              metadata.duration = parseFloat(probeData.format.duration);
            }

            resolve(metadata);
          });
        });
      }

      return metadata;
    } catch (error) {
      logger.error('Error extracting metadata:', error);
      return {
        width: null,
        height: null,
        duration: null,
        exif: null,
      };
    }
  }
}

export default new MetadataService();

