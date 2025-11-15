import Ajv from 'ajv';
import logger from '../utils/logger.js';

class SchemaGeneratorService {
  constructor() {
    this.ajv = new Ajv();
  }

  /**
   * Generate PostgreSQL DDL from field analysis
   * @param {string} tableName - Name of the table
   * @param {Object} fields - Field definitions from JSON analysis
   * @returns {string} SQL DDL statement
   */
  generatePostgresDDL(tableName, fields) {
    const columns = ['id SERIAL PRIMARY KEY', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'];

    for (const [fieldName, fieldInfo] of Object.entries(fields)) {
      const columnName = this.sanitizeIdentifier(fieldName);
      const columnType = this.mapToPostgresType(fieldInfo);
      const nullable = fieldInfo.nullable ? '' : ' NOT NULL';

      columns.push(`${columnName} ${columnType}${nullable}`);
    }

    const ddl = `CREATE TABLE IF NOT EXISTS ${this.sanitizeIdentifier(tableName)} (\n  ${columns.join(',\n  ')}\n);`;

    logger.info(`Generated PostgreSQL DDL for table: ${tableName}`);
    return ddl;
  }

  /**
   * Map field info to PostgreSQL data type
   * @param {Object} fieldInfo - Field information
   * @returns {string} PostgreSQL data type
   */
  mapToPostgresType(fieldInfo) {
    const types = fieldInfo.types || [];

    // Handle nested structures
    if (fieldInfo.nested) {
      return 'JSONB';
    }

    // Handle multiple types (use most permissive)
    if (types.length > 1) {
      if (types.includes('string')) return 'TEXT';
      if (types.includes('number')) return 'DOUBLE PRECISION';
      return 'JSONB';
    }

    // Single type mapping
    const type = types[0];
    switch (type) {
      case 'string':
        return 'TEXT';
      case 'number':
        return 'DOUBLE PRECISION';
      case 'boolean':
        return 'BOOLEAN';
      case 'object':
      case 'array':
        return 'JSONB';
      default:
        return 'TEXT';
    }
  }

  /**
   * Generate JSON Schema from field analysis
   * @param {Object} fields - Field definitions from JSON analysis
   * @returns {Object} JSON Schema object
   */
  generateJsonSchema(fields) {
    const properties = {};
    const required = [];

    for (const [fieldName, fieldInfo] of Object.entries(fields)) {
      const property = this.mapToJsonSchemaType(fieldInfo);
      properties[fieldName] = property;

      if (!fieldInfo.nullable) {
        required.push(fieldName);
      }
    }

    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };

    logger.info('Generated JSON Schema');
    return schema;
  }

  /**
   * Map field info to JSON Schema type
   * @param {Object} fieldInfo - Field information
   * @returns {Object} JSON Schema property definition
   */
  mapToJsonSchemaType(fieldInfo) {
    const types = fieldInfo.types || [];

    // Handle nested objects
    if (fieldInfo.nested && fieldInfo.nestedFields) {
      if (types.includes('object')) {
        return {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(fieldInfo.nestedFields).map(([key, value]) => [
              key,
              this.mapToJsonSchemaType(value),
            ])
          ),
        };
      }
      if (types.includes('array')) {
        return {
          type: 'array',
          items: { type: 'object' },
        };
      }
    }

    // Handle multiple types
    if (types.length > 1) {
      const schemaTypes = types.map(t => this.mapSingleTypeToJsonSchema(t));
      return { type: schemaTypes };
    }

    // Single type
    const type = types[0];
    return { type: this.mapSingleTypeToJsonSchema(type) };
  }

  /**
   * Map single type to JSON Schema type
   * @param {string} type - JavaScript type
   * @returns {string} JSON Schema type
   */
  mapSingleTypeToJsonSchema(type) {
    switch (type) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'object';
      case 'array':
        return 'array';
      default:
        return 'string';
    }
  }

  /**
   * Sanitize identifier for SQL
   * @param {string} identifier - Identifier to sanitize
   * @returns {string} Sanitized identifier
   */
  sanitizeIdentifier(identifier) {
    return identifier
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&');
  }

  /**
   * Generate table name from file info
   * @param {string} originalName - Original file name
   * @param {string} datasetId - Dataset ID
   * @returns {string} Table name
   */
  generateTableName(originalName, datasetId) {
    const baseName = originalName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');

    return `dataset_${this.sanitizeIdentifier(baseName)}_${datasetId.substring(0, 8)}`;
  }

  /**
   * Validate data against JSON Schema
   * @param {Object} schema - JSON Schema
   * @param {Object} data - Data to validate
   * @returns {Object} Validation result
   */
  validateAgainstSchema(schema, data) {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    return {
      valid,
      errors: validate.errors,
    };
  }
}

export default new SchemaGeneratorService();
