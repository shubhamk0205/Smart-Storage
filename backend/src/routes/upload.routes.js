import express from 'express';
import { upload, handleMulterError } from '../middleware/upload.middleware.js';
import fileTypeService from '../services/file-type.service.js';
import mediaPipeline from '../services/media-pipeline.service.js';
import jsonPipeline from '../services/json-pipeline.service.js';
import schemaGenerator from '../services/schema-generator.service.js';
import catalogService from '../services/catalog.service.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

const router = express.Router();

/**
 * Upload and process file
 */
router.post('/', upload.single('file'), handleMulterError, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const datasetId = uuidv4();
    const filePath = req.file.path;

    logger.info(`Processing file: ${req.file.originalname}, ID: ${datasetId}`);

    // Step 1: Detect file type
    const fileTypeInfo = await fileTypeService.detectFromFile(filePath);
    logger.info(`File type detected: ${fileTypeInfo.mime}, category: ${fileTypeInfo.category}`);

    // Step 2: Initialize dataset metadata
    const datasetInfo = {
      datasetId,
      originalName: req.file.originalname,
      filePath,
      fileSize: req.file.size,
      mimeType: fileTypeInfo.mime,
      extension: fileTypeInfo.ext,
      category: fileTypeInfo.category,
      storage: 'file', // Default storage
      metadata: {},
      processing: {
        processed: false,
      },
      recordCount: 0,
    };

    // Step 3: Process based on category
    if (['image', 'video', 'audio'].includes(fileTypeInfo.category)) {
      // Media pipeline
      const processingResult = await mediaPipeline.processMedia(filePath, fileTypeInfo.category);
      datasetInfo.metadata = processingResult.metadata || {};
      datasetInfo.processing = {
        processed: processingResult.processed,
        thumbnailPath: processingResult.thumbnailPath,
      };
      datasetInfo.storage = 'file';
    } else if (fileTypeInfo.category === 'json') {
      // JSON pipeline
      const processingResult = await jsonPipeline.processJson(filePath, fileTypeInfo.ext);

      datasetInfo.recordCount = processingResult.recordCount;
      datasetInfo.metadata = processingResult.analysis;
      datasetInfo.processing.processed = true;

      // Step 4: Generate schemas for JSON data
      if (processingResult.analysis?.fields) {
        const tableName = schemaGenerator.generateTableName(req.file.originalname, datasetId);
        const ddl = schemaGenerator.generatePostgresDDL(tableName, processingResult.analysis.fields);
        const jsonSchema = schemaGenerator.generateJsonSchema(processingResult.analysis.fields);

        datasetInfo.schema = {
          jsonSchema,
          sqlDDL: ddl,
          tableName,
          fields: processingResult.analysis.fields,
        };

        // Step 5: Store data in database
        if (jsonPipeline.isArrayOfObjects(processingResult.data)) {
          // Store in PostgreSQL
          try {
            await catalogService.storeInPostgres(tableName, ddl, processingResult.data);
            datasetInfo.storage = 'postgres';
          } catch (error) {
            logger.error('Failed to store in PostgreSQL, falling back to MongoDB:', error);
            // Fallback to MongoDB
            await catalogService.storeInMongoDB(datasetId, processingResult.data);
            datasetInfo.storage = 'mongodb';
          }
        } else {
          // Store in MongoDB for non-tabular data
          await catalogService.storeInMongoDB(datasetId,
            Array.isArray(processingResult.data) ? processingResult.data : [processingResult.data]
          );
          datasetInfo.storage = 'mongodb';
        }
      }
    }

    // Step 6: Catalog the dataset
    const dataset = await catalogService.createDataset(datasetInfo);

    logger.info(`Dataset created successfully: ${datasetId}`);

    res.status(201).json({
      success: true,
      message: 'File uploaded and processed successfully',
      dataset: {
        id: dataset.datasetId,
        name: dataset.originalName,
        category: dataset.category,
        mimeType: dataset.mimeType,
        storage: dataset.storage,
        recordCount: dataset.recordCount,
        createdAt: dataset.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error processing upload:', error);
    next(error);
  }
});

export default router;
