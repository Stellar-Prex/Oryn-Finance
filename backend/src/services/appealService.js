const { v4: uuidv4 } = require('uuid');
const { Appeal, Market, User } = require('../models');
const logger = require('../config/logger');

class AppealService {
  /**
   * Submit a new appeal for market resolution
   */
  static async submitAppeal(appealData) {
    try {
      const {
        marketId,
        appealedBy,
        reason,
        description,
        evidence = []
      } = appealData;

      // Verify market exists and is resolved
      const market = await Market.findOne({ marketId });
      if (!market) {
        throw new Error(`Market ${marketId} not found`);
      }

      if (market.status !== 'resolved' && market.status !== 'disputed') {
        throw new Error('Can only appeal resolved or disputed markets');
      }

      // Check if user already has pending appeal for this market
      const existingAppeal = await Appeal.findOne({
        marketId,
        appealedBy,
        status: { $in: ['submitted', 'under-review'] }
      });

      if (existingAppeal) {
        throw new Error('You already have a pending appeal for this market');
      }

      // Create appeal
      const appeal = await Appeal.create({
        appealId: uuidv4(),
        marketId,
        appealedBy,
        originalResolution: {
          outcome: market.resolvedOutcome,
          resolvedAt: market.resolvedAt,
          resolvedBy: market.resolvedBy,
          resolutionTransactionHash: market.resolutionTransactionHash
        },
        appealReason: reason,
        description,
        evidence: evidence.map(e => ({
          ...e,
          uploadedAt: new Date()
        })),
        dispute: {
          marketQuestion: market.question,
          category: market.category,
          originalResolutionCriteria: market.resolutionCriteria
        },
        status: 'submitted'
      });

      // Update market status to disputed if not already
      if (market.status !== 'disputed') {
        await Market.updateOne({ marketId }, { status: 'disputed' });
      }

      // Log appeal history
      await this._logAppealHistory(appeal._id, 'appeal-submitted', appealedBy, {
        reason,
        evidenceCount: evidence.length
      });

      // Notify relevant reviewers
      await this._notifyReviewersOfNewAppeal(appeal);

      return appeal;
    } catch (error) {
      logger.error('Error submitting appeal:', error);
      throw error;
    }
  }

  /**
   * Assign reviewers to appeal
   */
  static async assignReviewers(appealId, reviewerAddresses) {
    try {
      const appeal = await Appeal.findOne({ appealId });
      if (!appeal) {
        throw new Error(`Appeal ${appealId} not found`);
      }

      const assignedReviewers = reviewerAddresses.map(addr => ({
        reviewerAddress: addr,
        assignedAt: new Date(),
        status: 'pending'
      }));

      // Set voting period to 7 days from now
      const votingEndAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await Appeal.updateOne(
        { appealId },
        {
          'reviewProcess.assignedReviewers': assignedReviewers,
          'reviewProcess.votingEndAt': votingEndAt,
          status: 'under-review'
        }
      );

      // Log assignment
      await this._logAppealHistory(appeal._id, 'reviewers-assigned', 'system', {
        reviewersCount: reviewerAddresses.length,
        votingEndsAt: votingEndAt
      });

      return appeal;
    } catch (error) {
      logger.error('Error assigning reviewers:', error);
      throw error;
    }
  }

  /**
   * Submit a review vote
   */
  static async submitReviewVote(appealId, reviewerAddress, vote, reasoning = '') {
    try {
      const appeal = await Appeal.findOne({ appealId });
      if (!appeal) {
        throw new Error(`Appeal ${appealId} not found`);
      }

      // Check if reviewer is assigned
      const isAssigned = appeal.reviewProcess.assignedReviewers.some(
        r => r.reviewerAddress === reviewerAddress
      );

      if (!isAssigned) {
        throw new Error('Reviewer not assigned to this appeal');
      }

      // Check voting period
      const now = new Date();
      if (now > appeal.reviewProcess.votingEndAt) {
        throw new Error('Voting period has ended');
      }

      // Add vote
      const newVote = {
        reviewerAddress,
        vote,
        reasoning,
        votedAt: new Date()
      };

      // Update vote count
      const voteUpdate = {
        'reviewProcess.votes': [...appeal.reviewProcess.votes, newVote],
        'reviewProcess.totalVotes': appeal.reviewProcess.totalVotes + 1
      };

      if (vote === 'support-appeal') {
        voteUpdate['reviewProcess.supportVotes'] = appeal.reviewProcess.supportVotes + 1;
      } else if (vote === 'reject-appeal') {
        voteUpdate['reviewProcess.rejectVotes'] = appeal.reviewProcess.rejectVotes + 1;
      }

      // Update reviewer status
      const updatedReviewers = appeal.reviewProcess.assignedReviewers.map(r =>
        r.reviewerAddress === reviewerAddress
          ? { ...r, status: 'voted' }
          : r
      );
      voteUpdate['reviewProcess.assignedReviewers'] = updatedReviewers;

      await Appeal.updateOne({ appealId }, voteUpdate);

      // Log vote
      await this._logAppealHistory(appeal._id, 'vote-submitted', reviewerAddress, {
        vote,
        reasoning
      });

      return appeal;
    } catch (error) {
      logger.error('Error submitting review vote:', error);
      throw error;
    }
  }

  /**
   * Finalize appeal resolution based on votes
   */
  static async finalizeAppealResolution(appealId) {
    try {
      const appeal = await Appeal.findOne({ appealId });
      if (!appeal) {
        throw new Error(`Appeal ${appealId} not found`);
      }

      // Check if voting period ended
      const now = new Date();
      if (now <= appeal.reviewProcess.votingEndAt) {
        throw new Error('Voting period has not ended yet');
      }

      // Calculate consensus
      const { supportVotes, rejectVotes, totalVotes } = appeal.reviewProcess;
      const supportPercentage = totalVotes > 0 ? supportVotes / totalVotes : 0;

      let consensus = 'appeal-rejected';
      if (supportPercentage > 0.66) {
        consensus = 'appeal-approved';
      } else if (supportPercentage >= 0.33) {
        consensus = 'pending'; // Require more review or random assignment
      }

      // If appeal is approved, update market resolution
      let finalOutcome = appeal.originalResolution.outcome;
      if (consensus === 'appeal-approved') {
        // Determine new outcome based on evidence or majority decision
        // This is a simplified version - actual implementation may be more complex
        finalOutcome = this._determineNewOutcome(appeal);
      }

      const updateData = {
        'reviewProcess.consensus': consensus,
        'resolution.finalOutcome': finalOutcome,
        'resolution.explanation': `Appeal consensus: ${consensus}. Support votes: ${supportVotes}/${totalVotes}`,
        'resolution.resolvedAt': new Date(),
        status: consensus === 'appeal-approved' ? 'approved' : 'rejected'
      };

      await Appeal.updateOne({ appealId }, updateData);

      // If approved, update market status
      if (consensus === 'appeal-approved') {
        await Market.updateOne(
          { marketId: appeal.marketId },
          {
            status: 'resolved',
            resolvedOutcome: finalOutcome,
            resolvedAt: new Date()
          }
        );
      }

      // Log resolution
      await this._logAppealHistory(appeal._id, 'appeal-resolved', 'system', {
        consensus,
        finalOutcome
      });

      // Notify parties
      await this._notifyAppealResolution(appeal);

      return appeal;
    } catch (error) {
      logger.error('Error finalizing appeal resolution:', error);
      throw error;
    }
  }

  /**
   * Get appeal details with full context
   */
  static async getAppealDetails(appealId) {
    try {
      const appeal = await Appeal.findOne({ appealId }).lean();
      if (!appeal) {
        throw new Error(`Appeal ${appealId} not found`);
      }

      const market = await Market.findOne({ marketId: appeal.marketId }).lean();

      return {
        ...appeal,
        marketDetails: market,
        reviewerStatuses: appeal.reviewProcess.assignedReviewers.map(r => ({
          reviewerAddress: r.reviewerAddress,
          status: r.status,
          assignedAt: r.assignedAt
        })),
        voteStats: {
          support: appeal.reviewProcess.supportVotes,
          reject: appeal.reviewProcess.rejectVotes,
          abstain: appeal.reviewProcess.totalVotes - 
                   appeal.reviewProcess.supportVotes - 
                   appeal.reviewProcess.rejectVotes,
          total: appeal.reviewProcess.totalVotes
        }
      };
    } catch (error) {
      logger.error('Error getting appeal details:', error);
      throw error;
    }
  }

  /**
   * Get appeals by filters
   */
  static async getAppeals(filters = {}, limit = 50, skip = 0) {
    try {
      const {
        status,
        marketId,
        appealedBy,
        priority,
        sortBy = '-createdAt'
      } = filters;

      const query = {};
      if (status) query.status = status;
      if (marketId) query.marketId = marketId;
      if (appealedBy) query.appealedBy = appealedBy;
      if (priority) query.priority = priority;

      const appeals = await Appeal.find(query)
        .sort(sortBy)
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await Appeal.countDocuments(query);

      return {
        appeals,
        total,
        limit,
        skip
      };
    } catch (error) {
      logger.error('Error getting appeals:', error);
      throw error;
    }
  }

  // Private helper methods

  static async _logAppealHistory(appealId, action, actor, details = {}) {
    try {
      await Appeal.updateOne(
        { _id: appealId },
        {
          $push: {
            appealHistory: {
              action,
              actor,
              details,
              timestamp: new Date()
            }
          }
        }
      );
    } catch (error) {
      logger.error('Error logging appeal history:', error);
    }
  }

  static _determineNewOutcome(appeal) {
    // Simplified logic - in production, this would be more sophisticated
    const votes = appeal.reviewProcess.votes;
    const supportCount = votes.filter(v => v.vote === 'support-appeal').length;
    const rejectCount = votes.filter(v => v.vote === 'reject-appeal').length;

    if (supportCount > rejectCount) {
      // Flip the original outcome
      return appeal.originalResolution.outcome === 'yes' ? 'no' : 'yes';
    }

    return appeal.originalResolution.outcome;
  }

  static async _notifyReviewersOfNewAppeal(appeal) {
    try {
      // Implementation would depend on your notification service
      logger.info(`Notify reviewers about new appeal: ${appeal.appealId}`);
    } catch (error) {
      logger.error('Error notifying reviewers:', error);
    }
  }

  static async _notifyAppealResolution(appeal) {
    try {
      // Implementation would depend on your notification service
      logger.info(`Notify users about appeal resolution: ${appeal.appealId}`);
    } catch (error) {
      logger.error('Error notifying appeal resolution:', error);
    }
  }
}

module.exports = AppealService;
