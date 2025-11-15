import db from '../config/knex.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';
import fs from 'fs/promises';

class StagingModel {
  /**
   * Ensure staging_files table exists
   */
  async ensureTable() {
    const exists = await db.schema.hasTable('staging_files');
    if (!exists) {
      await db.schema.createTable('staging_files', (table) => {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.string('original_filename', 500).notNullable();
        table.string('file_path', 1000).notNullable();
        table.bigInteger('size_bytes').notNullable();
        table.string('sha256', 64).notNullable();
        table.string('mime_type', 100).nullable();
        table.string('file_kind', 50).nullable();
        table.string('status', 50).defaultTo('pending').notNullable();
        table.string('dataset_name', 255).nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
        
        table.index('status');
        table.index('created_at');
        table.index('sha256');
      });
      logger.info('staging_files table created');
    }
  }

  /**
   * Calculate SHA256 hash of file
   */
  async calculateSHA256(filePath) {
    const hash = crypto.createHash('sha256');
    const fileBuffer = await fs.readFile(filePath);
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  /**
   * Create staging file record
   */
  async create(filePath, originalFilename, datasetName = null) {
    await this.ensureTable();
    
    const stats = await fs.stat(filePath);
    const sha256 = await this.calculateSHA256(filePath);
    
    const [record] = await db('staging_files')
      .insert({
        original_filename: originalFilename,
        file_path: filePath,
        size_bytes: stats.size,
        sha256,
        status: 'pending',
        dataset_name: datasetName,
      })
      .returning('*');
    
    return {
      id: record.id,
      originalFilename: record.original_filename,
      filePath: record.file_path,
      size: record.size_bytes,
      sha256: record.sha256,
      status: record.status,
      createdAt: record.created_at,
      mimeType: record.mime_type,
      fileKind: record.file_kind,
      datasetName: record.dataset_name,
    };
  }

  /**
   * Get all staging files
   */
  async getAll() {
    await this.ensureTable();
    const records = await db('staging_files')
      .select('*')
      .orderBy('created_at', 'desc');
    
    return records.map(r => ({
      id: r.id,
      originalFilename: r.original_filename,
      size: r.size_bytes,
      sha256: r.sha256,
      status: r.status,
      createdAt: r.created_at,
      mimeType: r.mime_type,
      fileKind: r.file_kind,
    }));
  }

  /**
   * Get staging file by ID
   */
  async getById(id) {
    await this.ensureTable();
    const record = await db('staging_files').where('id', id).first();
    if (!record) return null;
    
    return {
      id: record.id,
      originalFilename: record.original_filename,
      filePath: record.file_path,
      size: record.size_bytes,
      sha256: record.sha256,
      status: record.status,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      mimeType: record.mime_type,
      fileKind: record.file_kind,
      datasetName: record.dataset_name,
    };
  }

  /**
   * Get staging file by ID with filePath
   */
  async getByIdWithPath(id) {
    const file = await this.getById(id);
    if (!file) return null;
    return file;
  }

  /**
   * Update staging file
   */
  async update(id, updates) {
    await this.ensureTable();
    const [record] = await db('staging_files')
      .where('id', id)
      .update({
        ...updates,
        updated_at: db.fn.now(),
      })
      .returning('*');
    
    if (!record) return null;
    
    return {
      id: record.id,
      originalFilename: record.original_filename,
      size: record.size_bytes,
      sha256: record.sha256,
      status: record.status,
      createdAt: record.created_at,
      mimeType: record.mime_type,
      fileKind: record.file_kind,
    };
  }

  /**
   * Delete staging file
   */
  async delete(id) {
    await this.ensureTable();
    const record = await this.getById(id);
    if (record) {
      // Delete file from disk
      try {
        await fs.unlink(record.filePath);
      } catch (error) {
        logger.warn(`Failed to delete file ${record.filePath}:`, error);
      }
    }
    
    await db('staging_files').where('id', id).del();
    return true;
  }
}

export default new StagingModel();

