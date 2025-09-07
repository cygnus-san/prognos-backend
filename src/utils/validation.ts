/**
 * Validation utilities for the reward system
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RewardValidation {
  /**
   * Validate prediction value format
   * @param predictionValue - The prediction value to validate
   * @returns True if valid
   */
  static validatePredictionValue(predictionValue: string): boolean {
    if (!predictionValue || predictionValue.trim() === '') {
      return false;
    }

    const lower = predictionValue.toLowerCase().trim();
    
    // Check for yes/no values
    if (lower === 'yes' || lower === 'no') {
      return true;
    }

    // Check for numeric values (0-100)
    const numeric = parseFloat(predictionValue);
    return !isNaN(numeric) && numeric >= 0 && numeric <= 100;
  }

  /**
   * Validate outcome value
   * @param outcomeValue - The outcome value to validate
   * @throws ValidationError if invalid
   */
  static validateOutcomeValue(outcomeValue: any): void {
    if (outcomeValue === null || outcomeValue === undefined) {
      throw new ValidationError('Outcome value cannot be null or undefined');
    }

    const numeric = parseFloat(outcomeValue);
    if (isNaN(numeric)) {
      throw new ValidationError('Outcome value must be a number');
    }

    if (numeric < 0 || numeric > 100) {
      throw new ValidationError('Outcome value must be between 0 and 100');
    }
  }

  /**
   * Validate stake amount
   * @param stakeAmount - The stake amount to validate
   * @throws ValidationError if invalid
   */
  static validateStakeAmount(stakeAmount: any): void {
    if (stakeAmount === null || stakeAmount === undefined) {
      throw new ValidationError('Stake amount cannot be null or undefined');
    }

    const numeric = parseFloat(stakeAmount);
    if (isNaN(numeric)) {
      throw new ValidationError('Stake amount must be a number');
    }

    if (numeric <= 0) {
      throw new ValidationError('Stake amount must be positive');
    }

    // Optional: Add maximum stake limit
    const MAX_STAKE = 10000; // Adjust as needed
    if (numeric > MAX_STAKE) {
      throw new ValidationError(`Stake amount cannot exceed ${MAX_STAKE}`);
    }
  }

  /**
   * Validate wallet address format
   * @param walletAddress - The wallet address to validate
   * @throws ValidationError if invalid
   */
  static validateWalletAddress(walletAddress: any): void {
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new ValidationError('Wallet address is required and must be a string');
    }

    const trimmed = walletAddress.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Wallet address cannot be empty');
    }

    // Basic format validation (adjust based on your wallet format requirements)
    if (trimmed.length < 20 || trimmed.length > 100) {
      throw new ValidationError('Wallet address format is invalid');
    }
  }

  /**
   * Validate pool deadline
   * @param deadline - The deadline to validate
   * @param allowPastDeadline - Whether to allow past deadlines (default: false)
   * @throws ValidationError if invalid
   */
  static validateDeadline(deadline: any, allowPastDeadline: boolean = false): void {
    if (!deadline) {
      throw new ValidationError('Deadline is required');
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      throw new ValidationError('Invalid deadline format');
    }

    if (!allowPastDeadline && deadlineDate <= new Date()) {
      throw new ValidationError('Deadline must be in the future');
    }
  }

  /**
   * Validate pool data for creation
   * @param poolData - The pool data to validate
   * @throws ValidationError if invalid
   */
  static validatePoolCreation(poolData: any): void {
    if (!poolData.title || poolData.title.trim().length === 0) {
      throw new ValidationError('Pool title is required');
    }

    if (!poolData.description || poolData.description.trim().length === 0) {
      throw new ValidationError('Pool description is required');
    }

    if (!poolData.tag || poolData.tag.trim().length === 0) {
      throw new ValidationError('Pool tag is required');
    }

    this.validateDeadline(poolData.deadline);

    // Optional: Validate title and description length
    if (poolData.title.length > 200) {
      throw new ValidationError('Pool title is too long (max 200 characters)');
    }

    if (poolData.description.length > 1000) {
      throw new ValidationError('Pool description is too long (max 1000 characters)');
    }
  }

  /**
   * Sanitize input string
   * @param input - The input to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(input: any): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention
  }

  /**
   * Check if user can make a prediction on a pool
   * @param pool - The pool object
   * @param existingPrediction - Existing prediction (if any)
   * @param action - The action being performed ('vote' or 'stake')
   * @throws ValidationError if not allowed
   */
  static validatePredictionAction(pool: any, existingPrediction: any, action: 'vote' | 'stake'): void {
    if (!pool) {
      throw new ValidationError('Pool not found');
    }

    if (pool.isResolved) {
      throw new ValidationError('Cannot make predictions on resolved pools');
    }

    const now = new Date();
    if (now > new Date(pool.deadline)) {
      throw new ValidationError('Pool deadline has passed');
    }

    if (action === 'stake' && existingPrediction && existingPrediction.stakeAmount > 0) {
      // Allow additional stakes on same prediction
      const totalStakeLimit = 1000; // Adjust as needed
      if (existingPrediction.stakeAmount >= totalStakeLimit) {
        throw new ValidationError(`Maximum stake limit (${totalStakeLimit}) already reached`);
      }
    }
  }
}