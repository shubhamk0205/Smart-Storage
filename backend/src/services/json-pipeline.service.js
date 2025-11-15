import fs from 'fs/promises';
import ndjson from 'ndjson';
import { createReadStream } from 'fs';
import logger from '../utils/logger.js';

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
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<Object>} Processing results
   */
  async processJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Validate JSON before parsing
      this.validateJsonSyntax(content, filePath);
      
      const data = JSON.parse(content);

      const analysis = this.analyzeJsonStructure(data);

      logger.info(`JSON file processed: ${filePath}`);

      return {
        processed: true,
        dataType: 'json',
        recordCount: Array.isArray(data) ? data.length : 1,
        data: data,
        analysis,
      };
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
