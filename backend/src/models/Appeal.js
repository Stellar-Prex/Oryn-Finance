const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema({
  appealId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  marketId: {
    type: String,
    required: true,
    index: true
  },
  appealedBy: {
    type: String,
    required: true,
    index: true
  },
  originalResolution: {
    outcome: {
      type: String,
      enum: ['yes', 'no', 'invalid'],
      required: true
    },
    resolvedAt: Date,
    resolvedBy: String,
    resolutionTransactionHash: String
  },
  appealReason: {
    type: String,
    enum: ['resolution-criteria-not-met', 'oracle-error', 'subjective-interpretation', 'new-evidence', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  evidence: [{
    type: {
      type: String,
      enum: ['link', 'document', 'screenshot', 'article', 'other']
    },
    url: String,
    description: String,
    uploadedAt: Date
  }],
  status: {
    type: String,
    enum: ['submitted', 'under-review', 'approved', 'rejected', 'resolved'],
    default: 'submitted',
    index: true
  },
  reviewProcess: {
    assignedReviewers: [{
      reviewerAddress: String,
      assignedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'reviewing', 'voted'],
        default: 'pending'
      }
    }],
    votes: [{
      reviewerAddress: String,
      vote: {
        type: String,
        enum: ['support-appeal', 'reject-appeal', 'abstain']
      },
      reasoning: String,
      votedAt: Date
    }],
    supportVotes: {
      type: Number,
      default: 0
    },
    rejectVotes: {
      type: Number,
      default: 0
    },
    totalVotes: {
      type: Number,
      default: 0
    },
    votingEndAt: Date,
    consensus: {
      type: String,
      enum: ['pending', 'appeal-approved', 'appeal-rejected'],
      default: 'pending'
    }
  },
  resolution: {
    finalOutcome: {
      type: String,
      enum: ['yes', 'no', 'invalid'],
      default: null
    },
    explanation: String,
    resolvedAt: Date,
    resolvedBy: String
  },
  dispute: {
    marketQuestion: String,
    category: String,
    originalResolutionCriteria: String
  },
  timelines: {
    submittedAt: {
      type: Date,
      default: Date.now
    },
    reviewStartedAt: Date,
    reviewEndedAt: Date,
    finalResolutionAt: Date
  },
  appealHistory: [{
    action: String,
    actor: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: Date
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  tags: [String]
});

appealSchema.index({ status: 1, createdAt: -1 });
appealSchema.index({ appealedBy: 1, status: 1 });
appealSchema.index({ marketId: 1, status: 1 });

module.exports = mongoose.model('Appeal', appealSchema);
