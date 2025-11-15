import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class MediaPipelineService {
  constructor() {
    this.processedDir = path.join(process.cwd(), 'uploads', 'processed');
    this.thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    this.initDirectories();
  }

  async initDirectories() {
    try {
      await fs.mkdir(this.processedDir, { recursive: true });
      await fs.mkdir(this.thumbnailDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating directories:', error);
    }
  }

  /**
   * Process media file based on type
   * @param {string} filePath - Path to the uploaded file
   * @param {string} category - File category (image, video, audio)
   * @returns {Promise<Object>} Processing results
   */
  async processMedia(filePath, category) {
    try {
      switch (category) {
        case 'image':
          return await this.processImage(filePath);
        case 'video':
          return await this.processVideo(filePath);
        case 'audio':
          return await this.processAudio(filePath);
        default:
          logger.warn(`No processing pipeline for category: ${category}`);
          return { processed: false };
      }
    } catch (error) {
      logger.error('Error processing media:', error);
      throw error;
    }
  }

  /**
   * Process image file
   * @param {string} filePath - Path to the image file
   * @returns {Promise<Object>} Processing results
   */
  async processImage(filePath) {
    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Generate thumbnail
      const thumbnailPath = path.join(
        this.thumbnailDir,
        `thumb_${path.basename(filePath)}`
      );

      await sharp(filePath)
        .resize(300, 300, { fit: 'inside' })
        .toFile(thumbnailPath);

      logger.info(`Image processed: ${filePath}`);

      return {
        processed: true,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
        },
        thumbnailPath,
      };
    } catch (error) {
      logger.error('Error processing image:', error);
      throw error;
    }
  }

  /**
   * Process video file
   * @param {string} filePath - Path to the video file
   * @returns {Promise<Object>} Processing results
   */
  async processVideo(filePath) {
    return new Promise((resolve, reject) => {
      const thumbnailPath = path.join(
        this.thumbnailDir,
        `thumb_${path.basename(filePath, path.extname(filePath))}.jpg`
      );

      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('Error probing video:', err);
          return reject(err);
        }

        // Generate thumbnail at 1 second
        ffmpeg(filePath)
          .screenshots({
            timestamps: ['1'],
            filename: path.basename(thumbnailPath),
            folder: this.thumbnailDir,
            size: '300x300',
          })
          .on('end', () => {
            logger.info(`Video processed: ${filePath}`);

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            resolve({
              processed: true,
              metadata: {
                duration: metadata.format.duration,
                format: metadata.format.format_name,
                size: metadata.format.size,
                bitRate: metadata.format.bit_rate,
                video: videoStream ? {
                  codec: videoStream.codec_name,
                  width: videoStream.width,
                  height: videoStream.height,
                  frameRate: videoStream.r_frame_rate,
                } : null,
                audio: audioStream ? {
                  codec: audioStream.codec_name,
                  sampleRate: audioStream.sample_rate,
                  channels: audioStream.channels,
                } : null,
              },
              thumbnailPath,
            });
          })
          .on('error', (error) => {
            logger.error('Error generating video thumbnail:', error);
            // Resolve without thumbnail if screenshot fails
            resolve({
              processed: true,
              metadata: {
                duration: metadata.format.duration,
                format: metadata.format.format_name,
                size: metadata.format.size,
              },
              thumbnailPath: null,
            });
          });
      });
    });
  }

  /**
   * Process audio file
   * @param {string} filePath - Path to the audio file
   * @returns {Promise<Object>} Processing results
   */
  async processAudio(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('Error probing audio:', err);
          return reject(err);
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        logger.info(`Audio processed: ${filePath}`);

        resolve({
          processed: true,
          metadata: {
            duration: metadata.format.duration,
            format: metadata.format.format_name,
            size: metadata.format.size,
            bitRate: metadata.format.bit_rate,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              sampleRate: audioStream.sample_rate,
              channels: audioStream.channels,
              bitRate: audioStream.bit_rate,
            } : null,
          },
        });
      });
    });
  }
}

export default new MediaPipelineService();
