import { LDClient, LDLogger } from 'launchdarkly-js-client-sdk';

/**
 * Creates a logger that dynamically adjusts its behavior based on a feature flag value.
 * 
 * @param flagKey The feature flag key to check for the log level
 * @returns A logger that implements the LDLogger interface with an additional setClient method
 */
export function createFlagBasedLogger(flagKey = 'sdk-log-level'): LDLogger & { setClient: (client: LDClient) => void } {
  let ldClient: LDClient | null = null;
  let currentLogLevel = 'info'; // Default log level
  let isCheckingFlag = false; // Flag to prevent recursive logging
  let lastCheckTime = 0; // Last time we checked the flag
  const CHECK_INTERVAL = 5000; // Only check the flag every 5 seconds
  
  // Function to get the current log level from the flag
  const getLogLevel = (): string => {
    if (!ldClient) return currentLogLevel;
    
    // Prevent recursive logging
    if (isCheckingFlag) return currentLogLevel;
    
    // Only check the flag value every CHECK_INTERVAL milliseconds
    const now = Date.now();
    if (now - lastCheckTime < CHECK_INTERVAL) {
      return currentLogLevel;
    }
    
    try {
      // Set the flag to prevent recursive logging
      isCheckingFlag = true;
      lastCheckTime = now;
      
      // Get log level from feature flag, default to current level if flag isn't available
      const newLogLevel = ldClient.variation(flagKey, currentLogLevel);
      
      // Update the cached log level
      currentLogLevel = newLogLevel;
      
      // Reset the flag
      isCheckingFlag = false;
      
      return currentLogLevel;
    } catch (_) {
      // Reset the flag in case of error
      isCheckingFlag = false;
      return currentLogLevel;
    }
  };
  
  // Function to check if a message is an internal SDK message
  const isInternalSdkMessage = (message: string): boolean => {
    return (
      // Filter out JSON objects that look like flag evaluations
      (message.startsWith('{') && 
       (message.includes('"context"') || 
        message.includes('"key"') || 
        message.includes('"value"') || 
        message.includes('"version"') || 
        message.includes('"variation"') ||
        message.includes('"creationDate"'))) ||
      
      // Filter out specific SDK messages that cause noise
      message.includes('enqueueing "feature" event') ||
      message.includes('enqueueing "identify" event') ||
      message.includes('enqueueing "custom" event') ||
      message.includes('enqueueing "click" event') ||
      message.includes('enqueueing "page" event') ||
      
      // Filter out common debug messages
      message.includes('received streaming update') ||
      message.includes('received flag') ||
      message.includes('evaluating') ||
      message.includes('evaluation') ||
      message.includes('variation') ||
      
      // Filter out debug and summary events
      message.includes('Debug') ||
      message.includes('debug:') ||
      message.includes('Summary') ||
      message.includes('summary:') ||
      
      // Filter out any messages about the SDK log level flag itself
      message.toLowerCase().includes('sdk-log-level') ||
      message.includes('sdkLogLevel')
    );
  };
  
  // Function to check if a message is one of our custom formatted messages
  const isCustomFormattedMessage = (message: string): boolean => {
    return message.startsWith('[DEBUG] ') || 
           message.startsWith('[INFO] ') || 
           message.startsWith('[WARN] ') || 
           message.startsWith('[ERROR] ');
  };
  
  // Function to check if a message should be logged based on level
  const shouldLog = (level: string, message: string): boolean => {
    // Get the current log level
    const logLevel = getLogLevel();
    
    // Always filter out internal SDK messages regardless of log level
    if (isInternalSdkMessage(message)) {
      return false;
    }
    
    // For our custom formatted messages, apply log level rules
    if (isCustomFormattedMessage(message)) {
      switch (level) {
        case 'debug':
          return logLevel === 'debug';
        case 'info':
          return ['debug', 'info'].includes(logLevel);
        case 'warn':
          return ['debug', 'info', 'warn'].includes(logLevel);
        case 'error':
          return true; // Always log errors
        default:
          return false;
      }
    }
    
    // For SDK messages that aren't internal and aren't custom formatted,
    // only show them if they match the current log level
    switch (level) {
      case 'debug':
        return logLevel === 'debug';
      case 'info':
        return ['debug', 'info'].includes(logLevel);
      case 'warn':
        return ['debug', 'info', 'warn'].includes(logLevel);
      case 'error':
        return true; // Always log errors
      default:
        return false;
    }
  };
  
  return {
    debug: (message: string) => {
      // For debug messages, be extra cautious - only log our custom messages
      if (getLogLevel() === 'debug' && !isInternalSdkMessage(message)) {
        // Only log messages that don't look like internal SDK messages
        if (message.startsWith('[DEBUG]')) {
          // Already formatted
          console.log(message);
        } else {
          // Format with our prefix
          console.log(`[DEBUG] ${message}`);
        }
      }
    },
    info: (message: string) => {
      if (shouldLog('info', message)) {
        console.info(`[INFO] ${message}`);
      }
    },
    warn: (message: string) => {
      if (shouldLog('warn', message)) {
        console.warn(`[WARN] ${message}`);
      }
    },
    error: (message: string) => {
      if (shouldLog('error', message)) {
        console.error(`[ERROR] ${message}`);
      } else {
        // Always log errors from the SDK itself
        if (!isInternalSdkMessage(message)) {
          console.error(`[ERROR] ${message}`);
        }
      }
    },
    setClient: (client: LDClient) => {
      ldClient = client;
      
      // Set up a listener for flag changes to update the log level
      client.on('change', (changes) => {
        if (changes[flagKey]) {
          // Update the cached log level when the flag changes
          currentLogLevel = changes[flagKey].current;
        }
      });
    }
  };
}
