import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RetryConfig {
  maxRetries: number;
  retryDelays: number[]; // Milliseconds between retries
  retryableErrors: string[];
  backoffMultiplier: number;
}

export interface AnalysisAttempt {
  attemptNumber: number;
  startedAt: Date;
  completedAt?: Date;
  success: boolean;
  errorMessage?: string;
  errorCategory?: string;
  elementsFound?: number;
  duration?: number;
}

export interface RetryableAnalysisResult {
  success: boolean;
  finalAttempt: AnalysisAttempt;
  allAttempts: AnalysisAttempt[];
  totalRetries: number;
  totalDuration: number;
  gaveUpReason?: string;
}

@Injectable()
export class AnalysisRetryService {
  constructor(private prisma: PrismaService) {}

  private getDefaultRetryConfig(): RetryConfig {
    return {
      maxRetries: 3,
      retryDelays: [2000, 5000, 10000], // 2s, 5s, 10s
      retryableErrors: [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR', 
        'BROWSER_ERROR',
        'SSL_ERROR',
        'JAVASCRIPT_ERROR'
      ],
      backoffMultiplier: 1.5
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryableAnalysisResult & { result?: T }> {
    
    const retryConfig = { ...this.getDefaultRetryConfig(), ...config };
    const attempts: AnalysisAttempt[] = [];
    const overallStartTime = Date.now();

    for (let attemptNumber = 1; attemptNumber <= retryConfig.maxRetries + 1; attemptNumber++) {
      const attemptStartTime = Date.now();
      const attempt: AnalysisAttempt = {
        attemptNumber,
        startedAt: new Date(attemptStartTime),
        success: false
      };

      console.log(`🔄 ${operationName} - Attempt ${attemptNumber}/${retryConfig.maxRetries + 1}`);

      try {
        const result = await operation();
        const attemptEndTime = Date.now();
        
        attempt.completedAt = new Date(attemptEndTime);
        attempt.success = true;
        attempt.duration = attemptEndTime - attemptStartTime;
        
        // For analysis results, extract element count if available
        if (result && typeof result === 'object' && 'elements' in result) {
          attempt.elementsFound = (result as any).elements?.length || 0;
        }

        attempts.push(attempt);

        console.log(`✅ ${operationName} succeeded on attempt ${attemptNumber}`);
        
        return {
          success: true,
          finalAttempt: attempt,
          allAttempts: attempts,
          totalRetries: attemptNumber - 1,
          totalDuration: Date.now() - overallStartTime,
          result
        };

      } catch (error) {
        const attemptEndTime = Date.now();
        
        attempt.completedAt = new Date(attemptEndTime);
        attempt.success = false;
        attempt.errorMessage = error.message;
        attempt.duration = attemptEndTime - attemptStartTime;
        
        // Extract error category if available
        if (error.errorCategory) {
          attempt.errorCategory = error.errorCategory;
        } else {
          attempt.errorCategory = this.categorizeError(error.message);
        }

        attempts.push(attempt);

        console.log(`❌ ${operationName} failed on attempt ${attemptNumber}: ${error.message}`);

        // Check if this is the last attempt or if error is not retryable
        const isLastAttempt = attemptNumber >= retryConfig.maxRetries + 1;
        const isRetryableError = this.isRetryableError(attempt.errorCategory, retryConfig);
        
        if (isLastAttempt || !isRetryableError) {
          const gaveUpReason = isLastAttempt 
            ? `Maximum retry attempts (${retryConfig.maxRetries}) exceeded`
            : `Error type '${attempt.errorCategory}' is not retryable`;
            
          console.log(`🛑 ${operationName} giving up: ${gaveUpReason}`);
          
          return {
            success: false,
            finalAttempt: attempt,
            allAttempts: attempts,
            totalRetries: attemptNumber - 1,
            totalDuration: Date.now() - overallStartTime,
            gaveUpReason
          };
        }

        // Calculate delay before next retry
        const baseDelay = retryConfig.retryDelays[attemptNumber - 1] || retryConfig.retryDelays[retryConfig.retryDelays.length - 1];
        const backoffDelay = Math.floor(baseDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber - 1));
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        const finalDelay = backoffDelay + jitter;

        console.log(`⏱️ ${operationName} waiting ${Math.round(finalDelay)}ms before retry ${attemptNumber + 1}`);
        await this.delay(finalDelay);
      }
    }

    // This should never be reached, but included for completeness
    return {
      success: false,
      finalAttempt: attempts[attempts.length - 1],
      allAttempts: attempts,
      totalRetries: attempts.length - 1,
      totalDuration: Date.now() - overallStartTime,
      gaveUpReason: 'Unexpected end of retry loop'
    };
  }

  private isRetryableError(errorCategory: string, config: RetryConfig): boolean {
    return config.retryableErrors.includes(errorCategory);
  }

  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('net::err_') || message.includes('econnrefused') || message.includes('enotfound')) {
      return 'NETWORK_ERROR';
    }
    
    if (message.includes('timeout') || message.includes('waiting for')) {
      return 'TIMEOUT_ERROR';
    }
    
    if (message.includes('browser') || message.includes('chromium') || message.includes('target closed')) {
      return 'BROWSER_ERROR';
    }
    
    if (message.includes('ssl') || message.includes('certificate') || message.includes('tls')) {
      return 'SSL_ERROR';
    }
    
    if (message.includes('evaluate') || message.includes('javascript') || message.includes('runtime.evaluate')) {
      return 'JAVASCRIPT_ERROR';
    }
    
    if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
      return 'AUTHENTICATION_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Store retry history for analytics and monitoring
  async storeRetryHistory(projectId: string, operation: string, result: RetryableAnalysisResult): Promise<void> {
    try {
      // In a real implementation, you might want a separate retry_history table
      // For now, we'll store this as JSON in a generic log table or skip storage
      console.log(`📊 Retry stats for ${operation}: ${result.totalRetries} retries, ${result.totalDuration}ms total duration`);
      
      // Optional: Store in database for analytics
      // await this.prisma.analysisRetryLog.create({
      //   data: {
      //     projectId,
      //     operation,
      //     success: result.success,
      //     totalRetries: result.totalRetries,
      //     totalDuration: result.totalDuration,
      //     attempts: JSON.stringify(result.allAttempts),
      //     gaveUpReason: result.gaveUpReason
      //   }
      // });
      
    } catch (error) {
      console.error('Failed to store retry history:', error);
      // Don't throw - this is just for analytics
    }
  }

  // Generate retry recommendations based on failure patterns
  generateRetryRecommendations(attempts: AnalysisAttempt[]): string[] {
    const recommendations: string[] = [];
    const failureCategories = attempts
      .filter(a => !a.success)
      .map(a => a.errorCategory)
      .filter(c => c);

    const categoryCount = failureCategories.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (categoryCount.TIMEOUT_ERROR >= 2) {
      recommendations.push('Consider increasing timeout values for slow-loading pages');
      recommendations.push('Check if the target site has rate limiting or bot detection');
    }

    if (categoryCount.NETWORK_ERROR >= 2) {
      recommendations.push('Verify network connectivity and DNS resolution');
      recommendations.push('Check if the site is temporarily down or blocking requests');
    }

    if (categoryCount.BROWSER_ERROR >= 2) {
      recommendations.push('Browser instances may be unstable - consider restarting the service');
      recommendations.push('Check system resources (memory, CPU) for browser operations');
    }

    if (categoryCount.AUTHENTICATION_ERROR >= 1) {
      recommendations.push('Authentication credentials may be invalid or expired');
      recommendations.push('Verify the authentication flow is still working manually');
    }

    if (failureCategories.length === 0) {
      recommendations.push('Analysis completed successfully with retries');
    } else if (Object.keys(categoryCount).length > 2) {
      recommendations.push('Multiple error types detected - site may be experiencing issues');
    }

    return recommendations;
  }
}