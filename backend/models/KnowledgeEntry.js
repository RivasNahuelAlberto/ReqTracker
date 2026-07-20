import mongoose from 'mongoose';

const { Schema } = mongoose;

const KnowledgeEntrySchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    // Type of knowledge
    type: {
      type: String,
      enum: ['requirement', 'symbol', 'pattern', 'relationship', 'anti-pattern', 'best-practice'],
      index: true
    },
    // Source element that was promoted
    sourceId: String, // Reference to original requirement/symbol
    sourceType: String, // 'requirement' or 'symbol'
    
    // Extracted knowledge
    content: String, // The actual knowledge (text summary)
    embedding: [Number], // Semantic embedding for retrieval
    
    // Quality metrics
    quality_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    consistency_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    frequency: {
      type: Number,
      default: 1 // How many times this pattern appeared
    },
    
    // Promotion criteria
    promotionReason: {
      type: String,
      enum: ['high_quality', 'consistent', 'recurring', 'popular', 'validated', 'manual'],
      index: true
    },
    
    // Usage tracking
    usageCount: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    
    // Lifecycle
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days default
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    
    // Metadata
    tags: [String],
    relatedEntries: [
      {
        entryId: Schema.Types.ObjectId,
        confidence: Number
      }
    ],
    
    // Validation
    validatedBy: String, // 'system' | 'human' | 'manual'
    validationScore: {
      type: Number,
      min: 0,
      max: 1
    }
  },
  { timestamps: true }
);

// Indexes for efficient retrieval
KnowledgeEntrySchema.index({ projectId: 1, type: 1, isActive: 1 });
KnowledgeEntrySchema.index({ projectId: 1, quality_score: -1 });
KnowledgeEntrySchema.index({ projectId: 1, usageCount: -1 });
KnowledgeEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
KnowledgeEntrySchema.index({ projectId: 1, promotionReason: 1 });

export default mongoose.model('KnowledgeEntry', KnowledgeEntrySchema);
