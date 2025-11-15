import mongoose from 'mongoose';

const datasetSchema = new mongoose.Schema(
  {
    datasetId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['image', 'video', 'audio', 'json', 'text', 'document', 'other', 'unknown'],
      required: true,
    },
    storage: {
      type: String,
      enum: ['postgres', 'mongodb', 'file'],
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    schema: {
      jsonSchema: {
        type: mongoose.Schema.Types.Mixed,
      },
      sqlDDL: {
        type: String,
      },
      tableName: {
        type: String,
      },
      fields: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    processing: {
      processed: {
        type: Boolean,
        default: false,
      },
      thumbnailPath: {
        type: String,
      },
      error: {
        type: String,
      },
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    tags: [String],
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
datasetSchema.index({ category: 1, createdAt: -1 });
datasetSchema.index({ mimeType: 1 });
datasetSchema.index({ tags: 1 });

const Dataset = mongoose.model('Dataset', datasetSchema);

export default Dataset;
