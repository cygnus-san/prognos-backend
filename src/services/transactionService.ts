/**
 * Service for verifying STX transactions on the Stacks blockchain
 */

// Configuration for testnet/mainnet
const STACKS_API_URL =
  process.env.NODE_ENV === "production"
    ? "https://stacks-node-api.mainnet.stacks.co"
    : "https://stacks-node-api.testnet.stacks.co";

// Platform address that should receive stakes (should match frontend)
const PLATFORM_ADDRESS =
  process.env.PLATFORM_ADDRESS || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

// Convert STX to microSTX
const STX_TO_MICRO_STX = 1_000_000;

export interface TransactionData {
  tx_id: string;
  tx_type: string;
  sender_address: string;
  tx_status: string;
  token_transfer?: {
    recipient_address: string;
    amount: string;
    memo?: string;
  };
  fee_rate?: string;
  block_height?: number;
  canonical?: boolean;
}

export interface VerificationResult {
  isValid: boolean;
  error?: string;
  transactionData?: TransactionData;
}

export class TransactionService {
  /**
   * Fetch transaction data from Stacks API
   */
  static async fetchTransaction(txId: string): Promise<TransactionData | null> {
    try {
      const response = await fetch(`${STACKS_API_URL}/extended/v1/tx/${txId}`);

      if (response.status === 404) {
        // Transaction not found, might be too new
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as TransactionData;
    } catch (error) {
      console.error("Error fetching transaction:", error);
      throw new Error(
        `Failed to fetch transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Verify that a transaction matches the expected stake parameters
   */
  static async verifyStakeTransaction(
    txId: string,
    expectedSender: string,
    expectedAmount: number,
    maxAgeMinutes: number = 30
  ): Promise<VerificationResult> {
    try {
      const transactionData = await this.fetchTransaction(txId);

      console.log("Transaction data:", transactionData);

      if (!transactionData) {
        return {
          isValid: false,
          error: "Transaction not found or still pending",
        };
      }

      // Check transaction type
      if (transactionData.tx_type !== "token_transfer") {
        return {
          isValid: false,
          error: "Transaction is not a token transfer",
          transactionData,
        };
      }

      // Check transaction status
      if (transactionData.tx_status !== "success") {
        return {
          isValid: false,
          error: `Transaction failed with status: ${transactionData.tx_status}`,
          transactionData,
        };
      }

      // Check sender address
      if (transactionData.sender_address !== expectedSender) {
        return {
          isValid: false,
          error: "Transaction sender does not match expected address",
          transactionData,
        };
      }

      // Check amount (convert STX to microSTX for comparison)
      const expectedMicroSTX = Math.floor(expectedAmount * STX_TO_MICRO_STX);
      const actualMicroSTX = parseInt(
        transactionData.token_transfer?.amount || "0"
      );

      // Allow small tolerance for rounding errors
      const tolerance = 0.01 * STX_TO_MICRO_STX; // 0.01 STX tolerance
      const amountDifference = Math.abs(actualMicroSTX - expectedMicroSTX);

      if (amountDifference > tolerance) {
        return {
          isValid: false,
          error: `Transaction amount mismatch. Expected: ${expectedAmount} STX, Got: ${
            actualMicroSTX / STX_TO_MICRO_STX
          } STX`,
          transactionData,
        };
      }

      // Check transaction age (prevent replay attacks)
      if (transactionData.block_height && maxAgeMinutes > 0) {
        // For simplicity, we'll check if the transaction is in a recent block
        // In a production system, you'd want to track the current block height
        // and ensure the transaction is within the acceptable age range

        // Get current block height
        const currentBlockHeight = await this.getCurrentBlockHeight();
        if (
          currentBlockHeight &&
          transactionData.block_height < currentBlockHeight - maxAgeMinutes * 10
        ) {
          // Assuming ~1 minute per block, this is a rough estimate
          return {
            isValid: false,
            error: "Transaction is too old",
            transactionData,
          };
        }
      }

      return {
        isValid: true,
        transactionData,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Verification failed",
      };
    }
  }

  /**
   * Get current block height from Stacks API
   */
  static async getCurrentBlockHeight(): Promise<number | null> {
    try {
      const response = await fetch(`${STACKS_API_URL}/extended/v1/status`);
      if (!response.ok) return null;

      const status = (await response.json()) as any;
      return status.chain_tip?.block_height || null;
    } catch (error) {
      console.error("Error fetching current block height:", error);
      return null;
    }
  }

  /**
   * Check if transaction is confirmed (has block height)
   */
  static async isTransactionConfirmed(txId: string): Promise<boolean> {
    try {
      const transactionData = await this.fetchTransaction(txId);
      return !!(
        transactionData?.block_height && transactionData.tx_status === "success"
      );
    } catch (error) {
      console.error("Error checking transaction confirmation:", error);
      return false;
    }
  }

  /**
   * Get transaction confirmation count
   */
  static async getConfirmationCount(txId: string): Promise<number> {
    try {
      const transactionData = await this.fetchTransaction(txId);
      if (!transactionData?.block_height) return 0;

      const currentHeight = await this.getCurrentBlockHeight();
      if (!currentHeight) return 0;

      return Math.max(0, currentHeight - transactionData.block_height + 1);
    } catch (error) {
      console.error("Error getting confirmation count:", error);
      return 0;
    }
  }

  /**
   * Validate transaction ID format
   */
  static isValidTransactionId(txId: string): boolean {
    // Stacks transaction IDs are typically 64 character hex strings
    const txIdRegex = /^0x[a-fA-F0-9]{64}$/;
    return txIdRegex.test(txId);
  }

  /**
   * Extract memo from transaction (if available)
   */
  static extractMemo(transactionData: TransactionData): string | null {
    return transactionData.token_transfer?.memo || null;
  }
}
