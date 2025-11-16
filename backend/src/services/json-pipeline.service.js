import fs from 'fs/promises';
import { statSync } from 'fs';
import ndjson from 'ndjson';
import { createReadStream } from 'fs';
import streamJson from 'stream-json';
import streamArray from 'stream-json/streamers/StreamArray.js';
import streamObject from 'stream-json/streamers/StreamObject.js';
import logger from '../utils/logger.js';
import { appConfig } from '../config/app.config.js';

// Extract named exports from CommonJS modules
const { parse } = streamJson;

class JsonPipelineService {
  /**
   * Process JSON or NDJSON file
   * @param {string} filePath - Path to the file
   * @param {string} ext - File extension (json or ndjson)
   * @returns {Promise<Object>} Processing results
   */
  async processJson(filePath, ext) {
    try {
      if (ext === 'json') {
        return await this.processJsonFile(filePath);
      } else if (ext === 'ndjson') {
        return await this.processNdjsonFile(filePath);
      }
    } catch (error) {
      logger.error('Error processing JSON file:', error);
      throw error;
    }
  }

  /**
   * Process standard JSON file
   * Uses streaming for large files to avoid memory issues
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<Object>} Processing results
   */
  async processJsonFile(filePath) {
    try {
      // Check file size to decide between streaming and in-memory parsing
      const stats = statSync(filePath);
      const fileSize = stats.size;
      const streamingThreshold = appConfig.json?.streamingThreshold || 10485760; // 10MB default
      
      if (fileSize > streamingThreshold) {
        logger.info(`Large JSON file detected (${(fileSize / 1024 / 1024).toFixed(2)}MB), using streaming parser: ${filePath}`);
        return await this.processJsonFileStreaming(filePath);
      } else {
        logger.debug(`Small JSON file (${(fileSize / 1024 / 1024).toFixed(2)}MB), using in-memory parser: ${filePath}`);
        return await this.processJsonFileInMemory(filePath);
      }
    } catch (error) {
      logger.error('Error processing JSON file:', error);
      
      // Enhance error message with file context
      if (error instanceof SyntaxError) {
        const enhancedError = new Error(
          `Invalid JSON syntax in file: ${filePath}\n` +
          `Error: ${error.message}\n` +
          `Please check that your JSON file is properly formatted with matching brackets, braces, and quotes.`
        );
        enhancedError.name = 'JSONParseError';
        enhancedError.originalError = error;
        throw enhancedError;
      }
      
      throw error;
    }
  }

  /**
   * Process JSON file using in-memory parsing (for small files)
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<Object>} Processing results
   */
  async processJsonFileInMemory(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Validate JSON before parsing
    this.validateJsonSyntax(content, filePath);
    
    const data = JSON.parse(content);

    const analysis = this.analyzeJsonStructure(data);

    logger.info(`JSON file processed (in-memory): ${filePath}`);

    return {
      processed: true,
      dataType: 'json',
      recordCount: Array.isArray(data) ? data.length : 1,
      data: data,
      analysis,
    };
  }

  /**
   * Process JSON file using streaming (for large files)
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<Object>} Processing results
   */
  async processJsonFileStreaming(filePath) {
    return new Promise((resolve, reject) => {
      // First, peek at the first character to determine if it's an array or object
      const peekStream = createReadStream(filePath, { encoding: 'utf8', start: 0, end: 1 });
      let firstChar = '';
      
      peekStream.on('data', (chunk) => {
        firstChar = chunk.trim()[0];
      });
      
      peekStream.on('end', () => {
        const isArray = firstChar === '[';
        const isObject = firstChar === '{';
        
        if (!isArray && !isObject) {
          reject(new Error(`Invalid JSON format: Expected '[' or '{' at start of file, got '${firstChar}'`));
          return;
        }
        
        if (isArray) {
          this.streamJsonArray(filePath, resolve, reject);
        } else {
          this.streamJsonObject(filePath, resolve, reject);
        }
      });
      
      peekStream.on('error', (error) => {
        reject(new Error(`Error reading file: ${error.message}`));
      });
    });
  }

  /**
   * Stream a JSON array file
   * @param {string} filePath - Path to the JSON file
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  streamJsonArray(filePath, resolve, reject) {
    const records = [];
    let fieldTypes = {};
    let recordCount = 0;
    let firstChunk = true;
    const streamingBatchSize = appConfig.json?.streamingBatchSize || 10000;

    createReadStream(filePath, { encoding: 'utf8' })
      .pipe(parse())
      .pipe(streamArray.default ? streamArray.default() : streamArray())
      .on('data', ({ value }) => {
        if (firstChunk) {
          firstChunk = false;
          logger.debug('Detected JSON array, streaming records...');
        }
        
        records.push(value);
        recordCount++;
        
        // Analyze fields on-the-fly (sample first 100 records for schema)
        if (recordCount <= 100) {
          const sampleFields = this.extractFields([value]);
          fieldTypes = this.mergeFieldTypes(fieldTypes, sampleFields);
        }
        
        // Log progress for very large datasets
        if (recordCount % streamingBatchSize === 0) {
          logger.debug(`Streamed ${recordCount} records so far...`);
        }
      })
      .on('end', () => {
        // Finalize field analysis with all records if needed
        if (recordCount > 100) {
          const finalSample = records.slice(0, Math.min(100, records.length));
          fieldTypes = this.extractFields(finalSample);
        } else {
          fieldTypes = this.extractFields(records);
        }
        
        const analysis = {
          type: 'array',
          itemCount: recordCount,
          fields: fieldTypes,
        };

        logger.info(`JSON file processed (streaming): ${filePath}, records: ${recordCount}`);

        resolve({
          processed: true,
          dataType: 'json',
          recordCount,
          data: records,
          analysis,
        });
      })
      .on('error', (error) => {
        logger.error('Error in stream array processing:', error);
        reject(error);
      });
  }

  /**
   * Stream a JSON object file
   * @param {string} filePath - Path to the JSON file
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  streamJsonObject(filePath, resolve, reject) {
    const rootObject = {};
    let fieldTypes = {};
    let firstChunk = true;

    createReadStream(filePath, { encoding: 'utf8' })
      .pipe(parse())
      .pipe(streamObject.default ? streamObject.default() : streamObject())
      .on('data', ({ key, value }) => {
        if (firstChunk) {
          firstChunk = false;
          logger.debug('Detected JSON object, streaming properties...');
        }
        
        rootObject[key] = value;
        
        // If value is an array, analyze it
        if (Array.isArray(value) && value.length > 0) {
          const sampleFields = this.extractFields(value.slice(0, Math.min(10, value.length)));
          if (!fieldTypes[key]) {
            fieldTypes[key] = sampleFields;
          } else {
            fieldTypes[key] = this.mergeFieldTypes(fieldTypes[key], sampleFields);
          }
        }
      })
      .on('end', () => {
        // Analyze the root object structure
        fieldTypes = this.extractFields([rootObject]);
        
        const analysis = {
          type: 'object',
          fields: fieldTypes,
        };

        logger.info(`JSON file processed (streaming): ${filePath}, object with ${Object.keys(rootObject).length} top-level keys`);

        resolve({
          processed: true,
          dataType: 'json',
          recordCount: 1,
          data: rootObject,
          analysis,
        });
      })
      .on('error', (error) => {
        logger.error('Error in stream object processing:', error);
        reject(error);
      });
  }

  /**
   * Merge field types from multiple samples
   * @param {Object} existing - Existing field types
   * @param {Object} newFields - New field types to merge
   * @returns {Object} Merged field types
   */
  mergeFieldTypes(existing, newFields) {
    const merged = { ...existing };
    
    for (const [key, fieldInfo] of Object.entries(newFields)) {
      if (!merged[key]) {
        merged[key] = {
          types: [...fieldInfo.types],
          nullable: fieldInfo.nullable,
          nested: fieldInfo.nested,
          nestedFields: fieldInfo.nestedFields,
        };
      } else {
        // Merge types
        const existingTypes = new Set(merged[key].types);
        fieldInfo.types.forEach(t => existingTypes.add(t));
        merged[key].types = Array.from(existingTypes);
        
        // Update nullable if new field is nullable
        if (fieldInfo.nullable) {
          merged[key].nullable = true;
        }
        
        // Update nested if new field is nested
        if (fieldInfo.nested) {
          merged[key].nested = true;
          if (fieldInfo.nestedFields) {
            merged[key].nestedFields = this.mergeFieldTypes(
              merged[key].nestedFields || {},
              fieldInfo.nestedFields
            );
          }
        }
      }
    }
    
    return merged;
  }

  /**
   * Validate JSON syntax and provide helpful error messages
   * @param {string} content - JSON content to validate
   * @param {string} filePath - Path to the file (for error messages)
   * @throws {Error} If JSON is invalid
   */
  validateJsonSyntax(content, filePath) {
    // Check for common issues
    const trimmed = content.trim();
    
    // Check if file is empty
    if (!trimmed) {
      throw new Error(`JSON file is empty: ${filePath}`);
    }
    
    // Check for balanced brackets/braces
    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    
    if (openBraces !== closeBraces) {
      throw new Error(
        `Unbalanced braces in JSON file: ${filePath}\n` +
        `Found ${openBraces} opening braces ({) but ${closeBraces} closing braces (})\n` +
        `Please ensure all braces are properly closed.`
      );
    }
    
    if (openBrackets !== closeBrackets) {
      throw new Error(
        `Unbalanced brackets in JSON file: ${filePath}\n` +
        `Found ${openBrackets} opening brackets ([) but ${closeBrackets} closing brackets (])\n` +
        `Please ensure all brackets are properly closed.`
      );
    }
    
    // Check if content starts and ends with valid JSON characters
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      throw new Error(
        `JSON file must start with '{' or '[': ${filePath}\n` +
        `Found: "${trimmed.substring(0, 20)}..."`
      );
    }
    
    // Try to parse to get detailed error
    try {
      JSON.parse(content);
    } catch (parseError) {
      // Extract line and column from error message if available
      const errorMsg = parseError.message;
      let enhancedMsg = `Invalid JSON syntax in file: ${filePath}\n${errorMsg}`;
      
      // Try to extract position information
      const positionMatch = errorMsg.match(/position (\d+)/);
      if (positionMatch) {
        const position = parseInt(positionMatch[1]);
        const lines = content.substring(0, position).split('\n');
        const lineNumber = lines.length;
        const columnNumber = lines[lines.length - 1].length + 1;
        
        enhancedMsg += `\n\nLocation: Line ${lineNumber}, Column ${columnNumber}`;
        
        // Show context around the error
        if (lineNumber > 0 && lineNumber <= lines.length) {
          const contextLine = lines[lines.length - 1];
          enhancedMsg += `\nContext: "${contextLine.substring(Math.max(0, columnNumber - 20), columnNumber + 20)}"`;
        }
      }
      
      enhancedMsg += `\n\nCommon issues:\n` +
        `- Missing closing brackets (] or })\n` +
        `- Trailing commas before closing brackets\n` +
        `- Unquoted property names\n` +
        `- Unescaped quotes in strings\n` +
        `- Incomplete JSON structure`;
      
      const enhancedError = new Error(enhancedMsg);
      enhancedError.name = 'JSONValidationError';
      enhancedError.originalError = parseError;
      throw enhancedError;
    }
  }

  /**
   * Process NDJSON file
   * @param {string} filePath - Path to the NDJSON file
   * @returns {Promise<Object>} Processing results
   */
  async processNdjsonFile(filePath) {
    return new Promise((resolve, reject) => {
      const records = [];
      let recordCount = 0;

      createReadStream(filePath)
        .pipe(ndjson.parse())
        .on('data', (record) => {
          records.push(record);
          recordCount++;
        })
        .on('end', () => {
          const analysis = this.analyzeJsonStructure(records);

          logger.info(`NDJSON file processed: ${filePath}, records: ${recordCount}`);

          resolve({
            processed: true,
            dataType: 'ndjson',
            recordCount,
            data: records,
            analysis,
          });
        })
        .on('error', (error) => {
          logger.error('Error processing NDJSON file:', error);
          reject(error);
        });
    });
  }

  /**
   * Analyze JSON structure to infer schema
   * @param {Object|Array} data - JSON data
   * @returns {Object} Structure analysis
   */
  analyzeJsonStructure(data) {
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { type: 'array', items: 'empty' };
      }

      // Analyze first few records to infer schema
      const sample = data.slice(0, Math.min(10, data.length));
      const fields = this.extractFields(sample);

      return {
        type: 'array',
        itemCount: data.length,
        fields,
      };
    } else if (typeof data === 'object' && data !== null) {
      const fields = this.extractFields([data]);
      return {
        type: 'object',
        fields,
      };
    }

    return { type: typeof data };
  }

  /**
   * Extract fields and their types from sample data
   * @param {Array} sample - Sample records
   * @returns {Object} Field definitions
   */
  extractFields(sample) {
    const fieldTypes = {};

    for (const record of sample) {
      if (typeof record !== 'object' || record === null) {
        continue;
      }

      for (const [key, value] of Object.entries(record)) {
        if (!fieldTypes[key]) {
          fieldTypes[key] = {
            types: new Set(),
            nullable: false,
            nested: false,
          };
        }

        if (value === null || value === undefined) {
          fieldTypes[key].nullable = true;
        } else {
          const valueType = Array.isArray(value) ? 'array' : typeof value;
          fieldTypes[key].types.add(valueType);

          if (valueType === 'object' || valueType === 'array') {
            fieldTypes[key].nested = true;
            if (valueType === 'object') {
              fieldTypes[key].nestedFields = this.extractFields([value]);
            }
          }
        }
      }
    }

    // Convert Sets to Arrays for JSON serialization
    const result = {};
    for (const [key, info] of Object.entries(fieldTypes)) {
      result[key] = {
        types: Array.from(info.types),
        nullable: info.nullable,
        nested: info.nested,
        nestedFields: info.nestedFields,
      };
    }

    return result;
  }

  /**
   * Validate if data is array of objects (suitable for database storage)
   * @param {*} data - Data to validate
   * @returns {boolean} True if array of objects
   */
  isArrayOfObjects(data) {
    return (
      Array.isArray(data) &&
      data.length > 0 &&
      data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))
    );
  }

  /**
   * Flatten nested objects for database storage
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Prefix for nested keys
   * @returns {Object} Flattened object
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value === null || value === undefined) {
        flattened[newKey] = value;
      } else if (Array.isArray(value)) {
        // Store arrays as JSON strings
        flattened[newKey] = JSON.stringify(value);
      } else if (typeof value === 'object') {
        // Recursively flatten nested objects
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }
}

export default new JsonPipelineService();
