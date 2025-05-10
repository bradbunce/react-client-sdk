import React, { useEffect, useState } from 'react';
import { LDProvider, useLDClient, useFlags } from 'launchdarkly-react-client-sdk';
import { createFlagBasedLogger } from '../../../src/dynamicLogger';
import { LDContext } from 'launchdarkly-js-client-sdk';

// The logger is now created dynamically based on user input
// See the LoggerExample component below

/**
 * Component to update the logger with the client reference after initialization
 * and handle flag changes
 */
const LoggerUpdater: React.FC<{
  logger: ReturnType<typeof createFlagBasedLogger>;
  logLevelFlagKey: string;
}> = ({ logger, logLevelFlagKey }) => {
  const ldClient = useLDClient();
  
  useEffect(() => {
    if (ldClient) {
      logger.setClient(ldClient);
      
      // Get the flag key from the props
      const flagKey = logLevelFlagKey;
      
      // Log some messages to demonstrate different log levels
      ldClient.on('ready', () => {
        logger.debug(`This debug message will only appear if the ${flagKey} flag is set to "debug"`);
        logger.info(`This info message will appear if the ${flagKey} flag is set to "debug" or "info"`);
        logger.warn(`This warning message will appear if the ${flagKey} flag is set to "debug", "info", or "warn"`);
        logger.error('This error message will always appear');
        
        // Set up periodic logging to demonstrate the logger
        setInterval(() => {
          logger.debug(`Debug log test at ${new Date().toLocaleTimeString()}`);
          logger.info(`Info log test at ${new Date().toLocaleTimeString()}`);
          logger.warn(`Warning log test at ${new Date().toLocaleTimeString()}`);
          logger.error(`Error log test at ${new Date().toLocaleTimeString()}`);
        }, 5000);
      });
      
      // Set up debouncing for flag changes
      let debounceTimer: number | null = null;
      let lastLogLevel: unknown = null;
      
      // Set up a listener for flag changes
      const handleFlagChange = (changes: Record<string, { current: unknown; previous: unknown }>) => {
        // Get the flag key from props
        const flagKey = logLevelFlagKey;
        
        // If the custom log level flag changes, re-identify with the current context
        // to ensure we're using the correct context for evaluation
        const logLevelChange = changes[flagKey];
        
        if (logLevelChange) {
          // Get the new log level
          const newLogLevel = logLevelChange.current;
          
          // Only proceed if the log level has actually changed
          if (newLogLevel !== lastLogLevel) {
            // Update the last log level
            lastLogLevel = newLogLevel;
            
            // Clear any existing timer
            if (debounceTimer !== null) {
              window.clearTimeout(debounceTimer);
            }
            
            // Set a new timer to debounce multiple rapid changes
            debounceTimer = window.setTimeout(() => {
              const currentContext = ldClient.getContext();
              if (currentContext && !currentContext.anonymous) {
                // Only re-identify if we have a non-anonymous context
                logger.info(`Log level changed to ${String(newLogLevel)}, re-identifying with current context`);
                ldClient.identify(currentContext).then(() => {
                  logger.info('Context re-identified after log level change');
                });
              }
              debounceTimer = null;
            }, 500); // 500ms debounce time
          }
        }
      };
      
      ldClient.on('change', handleFlagChange);
      
      // Clean up event listener and timer when component unmounts
      return () => {
        ldClient.off('change', handleFlagChange);
        if (debounceTimer !== null) {
          window.clearTimeout(debounceTimer);
        }
      };
    }
  }, [ldClient]);
  
  return null;
};

/**
 * Component that displays the current context and flags
 */
const FlagDisplay: React.FC = () => {
  const flags = useFlags();
  const ldClient = useLDClient();
  const [currentContext, setCurrentContext] = useState<LDContext | null>(null);
  
  useEffect(() => {
    if (ldClient) {
      // Get the current context from the client
      setCurrentContext(ldClient.getContext());
      
      // Set up a listener for context changes
      const updateContext = () => {
        setCurrentContext(ldClient.getContext());
      };
      
      // Listen for the 'change' event which fires after context changes
      ldClient.on('change', updateContext);
      
      // Also listen for 'ready' event which fires after initialization
      ldClient.on('ready', updateContext);
      
      // Listen for the 'identify' event which fires after context changes via identify()
      ldClient.on('identify', updateContext);
      
      // Clean up listeners when component unmounts
      return () => {
        ldClient.off('change', updateContext);
        ldClient.off('ready', updateContext);
        ldClient.off('identify', updateContext);
      };
    }
  }, [ldClient]);
  
  return (
    <div className="flag-display">
      <h2>Current Context</h2>
      <pre>{JSON.stringify(currentContext, null, 2)}</pre>
      
      <h2>Current Flags</h2>
      <pre>{JSON.stringify(flags, null, 2)}</pre>
    </div>
  );
};

/**
 * Component that allows changing the user context
 */
const ContextSwitcher: React.FC<{
  logger: ReturnType<typeof createFlagBasedLogger>;
}> = ({ logger }) => {
  const ldClient = useLDClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (ldClient) {
      // Build a new context with the user information
      const newContext: LDContext = {
        kind: 'user',
        key: email || 'anonymous-user',
        name: name || undefined,
        email: email || undefined,
        custom: {
          role: role || undefined
        }
      };
      
      // Update the client with the new context
      ldClient.identify(newContext).then(() => {
        logger.info(`Context updated to: ${JSON.stringify(newContext)}`);
      });
    }
  };
  
  return (
    <div className="context-switcher">
      <h2>Change User Context</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Name:
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="User's name"
            />
          </label>
        </div>
        <div>
          <label>
            Email:
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="user@example.com"
            />
          </label>
        </div>
        <div>
          <label>
            Role:
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Select a role</option>
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="user">Regular User</option>
            </select>
          </label>
        </div>
        <button type="submit">Update Context</button>
      </form>
    </div>
  );
};

/**
 * Setup form to enter client ID and initial context
 */
const SetupForm: React.FC<{
  onSetup: (clientId: string, initialContext: LDContext, logLevelFlagKey: string) => void;
}> = ({ onSetup }) => {
  const [clientId, setClientId] = useState('');
  const [userKey, setUserKey] = useState('anonymous-user');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [logLevelFlagKey, setLogLevelFlagKey] = useState('custom-log-level');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      alert('Please enter your LaunchDarkly Client-Side ID');
      return;
    }
    
    const initialContext: LDContext = {
      kind: 'user',
      key: userKey,
      anonymous: isAnonymous
    };
    
    onSetup(clientId, initialContext, logLevelFlagKey);
  };
  
  return (
    <div className="setup-form">
      <h1>LaunchDarkly Flag-Based Logger Example</h1>
      <h2>Setup</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            LaunchDarkly Client-Side ID:
            <input 
              type="text" 
              value={clientId} 
              onChange={(e) => setClientId(e.target.value)} 
              placeholder="Enter your client-side ID"
              required
            />
          </label>
          <p className="help-text">
            Find this in your LaunchDarkly dashboard under Account Settings &gt; Projects
          </p>
        </div>
        <div>
          <label>
            Initial User Key:
            <input 
              type="text" 
              value={userKey} 
              onChange={(e) => setUserKey(e.target.value)} 
              placeholder="User key for initial context"
            />
          </label>
        </div>
        <div className="checkbox-field">
          <label>
            <input 
              type="checkbox" 
              checked={isAnonymous} 
              onChange={(e) => setIsAnonymous(e.target.checked)} 
            />
            Anonymous User
          </label>
        </div>
        <div>
          <label>
            Log Level Flag Key:
            <input 
              type="text" 
              value={logLevelFlagKey} 
              onChange={(e) => setLogLevelFlagKey(e.target.value)} 
              placeholder="Flag key for controlling log level"
            />
          </label>
          <p className="help-text">
            This is the feature flag key that will control the SDK's log level. Default is 'sdk-log-level'.
          </p>
        </div>
        <button type="submit">Initialize SDK</button>
      </form>
    </div>
  );
};

/**
 * Example component that demonstrates how to use the flag-based logger
 * and how to manage context information
 */
const LoggerExample: React.FC = () => {
  const [config, setConfig] = useState<{
    clientId: string;
    initialContext: LDContext;
    logLevelFlagKey: string;
  } | null>(null);
  
  const handleSetup = (clientId: string, initialContext: LDContext, logLevelFlagKey: string) => {
    setConfig({ clientId, initialContext, logLevelFlagKey });
  };
  
  // If config is not set, show the setup form
  if (!config) {
    return (
      <div className="app-container">
        <SetupForm onSetup={handleSetup} />
      </div>
    );
  }
  
  // Create a logger with the user-provided flag key
  const customLogger = createFlagBasedLogger({
    logLevelFlagKey: config.logLevelFlagKey
  });
  
  // If config is set, initialize the SDK and show the main UI
  return (
    <LDProvider
      clientSideID={config.clientId}
      context={config.initialContext}
      options={{
        logger: customLogger
      }}
    >
      <LoggerUpdater logger={customLogger} logLevelFlagKey={config.logLevelFlagKey} />
      <div className="app-container">
        <h1>LaunchDarkly Flag-Based Logger Example</h1>
        
        <style>
          {`
            .flag-key-highlight {
              background-color: #f0f8ff;
              border-left: 4px solid #0076ff;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            
            .code-snippet {
              background-color: #f5f5f5;
              padding: 15px;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
              line-height: 1.5;
              overflow-x: auto;
              white-space: pre;
            }
          `}
        </style>
        
        <div className="info-section">
          <h2>About This Example</h2>
          <p>
            This example demonstrates:
          </p>
          <ol>
            <li>How to use a feature flag to control the SDK's log level</li>
            <li>How to build and update context information for flag evaluation</li>
          </ol>
          <div className="flag-key-highlight">
            <h3>Custom Flag Key Configuration</h3>
            <p>
              This example uses a <strong>custom flag key</strong> instead of the default:
            </p>
            <pre className="code-snippet">
{`// Using a custom flag key
const loggerOptions = {
  logLevelFlagKey: '${config.logLevelFlagKey}'
};
const logger = createFlagBasedLogger(loggerOptions);

// Default would be:
// const logger = createFlagBasedLogger();  // Uses 'sdk-log-level' by default`}
            </pre>
          </div>
          
          <p>
            The log level is controlled by the <code>{config.logLevelFlagKey}</code> feature flag, which can be set to:
          </p>
          <ul>
            <li><code>debug</code> - Show all messages (debug, info, warn, error)</li>
            <li><code>info</code> - Show info, warn, and error messages (default)</li>
            <li><code>warn</code> - Show only warn and error messages</li>
            <li><code>error</code> - Show only error messages</li>
          </ul>
          <p>Check the browser console to see the log messages.</p>
        </div>
        
        <div className="context-section">
          <ContextSwitcher logger={customLogger} />
        </div>
        
        <div className="display-section">
          <FlagDisplay />
        </div>
        
        <div className="reset-section">
          <button onClick={() => setConfig(null)}>Reset Configuration</button>
        </div>
      </div>
    </LDProvider>
  );
};

export default LoggerExample;
