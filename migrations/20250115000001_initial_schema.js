/**
 * Initial migration for Smart Storage System
 * Creates the datasets_metadata table for tracking dataset information
 */

export async function up(knex) {
  // Create datasets_metadata table
  await knex.schema.createTable('datasets_metadata', (table) => {
    table.increments('id').primary();
    table.string('dataset_id', 255).notNullable().unique();
    table.string('original_name', 500).notNullable();
    table.string('file_path', 1000).notNullable();
    table.bigInteger('file_size').notNullable();
    table.string('mime_type', 255).notNullable();
    table.string('extension', 50).notNullable();
    table.enum('category', ['image', 'video', 'audio', 'json', 'text', 'document', 'other', 'unknown']).notNullable();
    table.enum('storage', ['postgres', 'mongodb', 'file']).notNullable();
    table.jsonb('metadata');
    table.jsonb('schema_info');
    table.string('table_name', 255);
    table.integer('record_count').defaultTo(0);
    table.boolean('processed').defaultTo(false);
    table.text('processing_error');
    table.timestamps(true, true);

    // Indexes
    table.index('dataset_id');
    table.index('category');
    table.index('storage');
    table.index('created_at');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('datasets_metadata');
}
