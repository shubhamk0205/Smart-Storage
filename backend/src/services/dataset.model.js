import mongoose from 'mongoose';

// Schema definition function - creates schema only when needed
const createDatasetSchema = () => {
  const schema = new mongoose.Schema(
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
      datasetSchema: {
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
  schema.index({ category: 1, createdAt: -1 });
  schema.index({ mimeType: 1 });
  schema.index({ tags: 1 });

  return schema;
};

// Lazy model creation - only create when mongoose is connected
let Dataset = null;

const getDatasetModel = async () => {
  // Wait for MongoDB connection if not ready
  if (mongoose.connection.readyState !== 1) {
    // Wait for connection (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MongoDB connection timeout. Cannot use Dataset model. Please ensure MongoDB is running and connected.'));
      }, 10000); // 10 second timeout

      // Check if already connected (race condition check)
      if (mongoose.connection.readyState === 1) {
        clearTimeout(timeout);
        resolve(getModel());
        return;
      }

      // Wait for connection event
      const onConnected = async () => {
        clearTimeout(timeout);
        mongoose.connection.removeListener('error', onError);
        // Wait a bit for Mongoose to fully initialize
        await new Promise((r) => setTimeout(r, 100));
        resolve(await getModel());
      };

      const onError = (err) => {
        clearTimeout(timeout);
        mongoose.connection.removeListener('connected', onConnected);
        reject(new Error(`MongoDB connection error: ${err.message}`));
      };

      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onError);
    });
  }

  return await getModel();
};

const getModel = async () => {
  if (!Dataset) {
    // Check if model already exists in mongoose.models
    if (mongoose.models.Dataset) {
      Dataset = mongoose.models.Dataset;
    } else {
      // Only create model if mongoose is connected AND connection is established
      const readyState = mongoose.connection.readyState;
      if (readyState !== 1) {
        throw new Error(`MongoDB is not connected. Cannot create Dataset model. Connection state: ${readyState} (1=connected, 0=disconnected, 2=connecting, 3=disconnecting)`);
      }
      
      // Double-check: ensure connection object exists and is valid
      if (!mongoose.connection.db) {
        // Wait a bit for the database object to be available
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (!mongoose.connection.db) {
          throw new Error('MongoDB connection exists but database object is not available. Connection may not be fully established.');
        }
      }
      
      // Verify Mongoose is fully initialized by checking internal properties
      if (!mongoose.connection.base || !mongoose.connection.base.models) {
        throw new Error('Mongoose is not fully initialized. Cannot create models yet.');
      }
      
      try {
        // Create schema only when mongoose is ready
        const schema = createDatasetSchema();
        Dataset = mongoose.model('Dataset', schema);
      } catch (schemaError) {
        const errorDetails = {
          message: schemaError.message,
          stack: schemaError.stack,
          readyState,
          hasDb: !!mongoose.connection.db,
          hasBase: !!mongoose.connection.base,
        };
        throw new Error(`Failed to create Dataset model: ${schemaError.message}. Details: ${JSON.stringify(errorDetails)}`);
      }
    }
  }
  return Dataset;
};

// Export a getter function that returns the model (now async)
export default getDatasetModel;
