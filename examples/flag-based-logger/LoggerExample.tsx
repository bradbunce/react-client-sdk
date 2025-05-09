import React, { useEffect, useState } from 'react';
import { LDProvider, useLDClient, useFlags } from 'launchdarkly-react-client-sdk';
import { createFlagBasedLogger } from '../../src/dynamicLogger';
import { LDContext } from 'launchdarkly-js-client-sdk';

// Create the logger instance
const logger = createFlagBasedLogger('sdk-log-level'); // or 'sdkLogLevel' if using camelCase

/**
 * Component to update the logger with the client reference after initialization
 */
const LoggerUpdater: React.FC = () => {
  const ldClient = useLDClient();
  
  useEffect(() => {
    if (ldClient) {
      logger.setClient(ldClient);
      
      // Log some messages to demonstrate different log levels
      ldClient.on('ready', () => {
        logger.debug('This debug message will only appear if the sdk-log-level flag is set to "debug"');
        logger.info('This info message will appear if the sdk-log-level flag is set to "debug" or "info"');
        logger.warn('This warning message will appear if the sdk-log-level flag is set to "debug", "info", or "warn"');
        logger.error('This error message will always appear');
      });
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
const ContextSwitcher: React.FC = () => {
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
  onSetup: (clientId: string, initialContext: LDContext) => void;
}> = ({ onSetup }) => {
  const [clientId, setClientId] = useState('');
  const [userKey, setUserKey] = useState('anonymous-user');
  const [isAnonymous, setIsAnonymous] = useState(true);
  
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
    
    onSetup(clientId, initialContext);
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
  } | null>(null);
  
  const handleSetup = (clientId: string, initialContext: LDContext) => {
    setConfig({ clientId, initialContext });
  };
  
  // If config is not set, show the setup form
  if (!config) {
    return (
      <div className="app-container">
        <SetupForm onSetup={handleSetup} />
        
        <style>
          {`
            .app-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            }
            
            .setup-form {
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 5px;
            }
            
            form div {
              margin-bottom: 20px;
            }
            
            label {
              display: block;
              margin-bottom: 5px;
            }
            
            .checkbox-field label {
              display: flex;
              align-items: center;
            }
            
            .checkbox-field input {
              margin-right: 10px;
              width: auto;
            }
            
            .help-text {
              margin-top: 5px;
              font-size: 0.9em;
              color: #666;
            }
            
            input, select {
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            
            button {
              background-color: #0076ff;
              color: white;
              border: none;
              padding: 10px 15px;
              border-radius: 4px;
              cursor: pointer;
            }
            
            button:hover {
              background-color: #0065db;
            }
          `}
        </style>
      </div>
    );
  }
  
  // If config is set, initialize the SDK and show the main UI
  return (
    <LDProvider
      clientSideID={config.clientId}
      context={config.initialContext}
      options={{
        logger: logger
      }}
    >
      <LoggerUpdater />
      <div className="app-container">
        <h1>LaunchDarkly Flag-Based Logger Example</h1>
        
        <div className="info-section">
          <h2>About This Example</h2>
          <p>
            This example demonstrates:
          </p>
          <ol>
            <li>How to use a feature flag to control the SDK's log level</li>
            <li>How to build and update context information for flag evaluation</li>
          </ol>
          <p>
            The log level is controlled by the <code>sdk-log-level</code> feature flag, which can be set to:
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
          <ContextSwitcher />
        </div>
        
        <div className="display-section">
          <FlagDisplay />
        </div>
        
        <div className="reset-section">
          <button onClick={() => setConfig(null)}>Reset Configuration</button>
        </div>
      </div>
      
      <style>
        {`
          .app-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          }
          
          .info-section, .context-section, .display-section, .reset-section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          
          form div {
            margin-bottom: 10px;
          }
          
          label {
            display: block;
            margin-bottom: 5px;
          }
          
          input, select {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          
          button {
            background-color: #0076ff;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
          }
          
          button:hover {
            background-color: #0065db;
          }
          
          pre {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            overflow: auto;
          }
          
          .reset-section button {
            background-color: #f44336;
          }
          
          .reset-section button:hover {
            background-color: #d32f2f;
          }
        `}
      </style>
    </LDProvider>
  );
};

export default LoggerExample;
