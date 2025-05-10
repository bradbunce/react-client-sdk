# Flag-Based Logger Example

This example demonstrates how to use a feature flag to control the LaunchDarkly SDK's log level at runtime and how to manage context information for flag evaluation.

## Features Demonstrated

1. **Flag-Based Logging**: Control the SDK's log level using a feature flag
2. **Context Management**: Build and update context information for flag evaluation
3. **Runtime Configuration**: Enter your LaunchDarkly client-side ID and initial context at runtime

## How to Run the Example

1. **Install Dependencies**:
   ```bash
   # From the root of the react-client-sdk repository
   npm install
   npm run build
   
   # Navigate to the example directory
   cd examples/flag-based-logger
   
   # Install dependencies
   npm install
   ```

2. **Start the Development Server**:
   ```bash
   npm run dev
   ```

3. **Access the Example**:
   - Open your browser to http://localhost:5173
   - You'll see a setup form where you can enter:
     - Your LaunchDarkly client-side ID
     - Initial user key
     - Whether the user is anonymous

## How the Flag-Based Logger Works

1. A custom logger is created that checks a feature flag value to determine which log messages to display
2. The SDK is initialized with this custom logger
3. After initialization, the logger is updated with a reference to the LaunchDarkly client
4. The logger then dynamically adjusts its behavior based on the feature flag value
5. When the log level flag changes, the example automatically re-identifies with the current context to ensure consistent evaluation

## How Context Management Works

1. The SDK is initialized with an initial context (anonymous user)
2. The example provides a UI to build a new context with user information
3. When the form is submitted, the SDK's context is updated using the `identify` method
4. Flag evaluations are then performed against the new context

## How Runtime Configuration Works

1. When you first load the example, you'll see a setup form
2. Enter your LaunchDarkly client-side ID and configure the initial context
3. Click "Initialize SDK" to start the application with your configuration
4. You can reset the configuration at any time using the "Reset Configuration" button

## Setting Up the Feature Flag

1. In your LaunchDarkly dashboard, create a new feature flag:
   - **Name**: Custom Log Level (or any name you prefer)
   - **Key**: This example uses `custom-log-level` to demonstrate the configurability, but you can use any flag key you want
   - **Variation Type**: String
   - **Variations**:
     - `debug` - Show all messages (debug, info, warn, error)
     - `info` - Show info, warn, and error messages (default)
     - `warn` - Show only warn and error messages
     - `error` - Show only error messages

2. Set up targeting rules as needed for different environments or users

> **Note**: The default flag key is `sdk-log-level` if you don't specify a custom key, but this example intentionally uses a custom key to demonstrate how to configure it.

## Using the Flag-Based Logger

To use the flag-based logger in your application:

1. Copy the `dynamicLogger.ts` file to your project
2. Create a logger instance:
   ```typescript
   // You can use the string format (for backward compatibility)
   const logger = createFlagBasedLogger('sdk-log-level');
   
   // Or use the options object for more clarity and future extensibility
   const loggerOptions = {
     logLevelFlagKey: 'custom-log-level' // Use any flag key you want
   };
   const logger = createFlagBasedLogger(loggerOptions);
   ```
3. Initialize the LaunchDarkly SDK with this logger:
   ```typescript
   <LDProvider
     clientSideID="your-client-side-id"
     context={{ key: 'user-key', kind: 'user' }}
     options={{
       logger: logger
     }}
   >
     {/* Your app components */}
   </LDProvider>
   ```
4. Update the logger with the client reference after initialization and set up automatic re-evaluation with debouncing:
   ```typescript
   const LoggerUpdater = () => {
     const ldClient = useLDClient();
     
     useEffect(() => {
       if (ldClient) {
         // Set the client reference in the logger
         logger.setClient(ldClient);
         
         // Set up debouncing for flag changes
         let debounceTimer = null;
         let lastLogLevel = null;
         
         // Set up a listener for flag changes to handle log level changes
         const handleFlagChange = (changes) => {
           // Get the flag key used by the logger (same as what you configured when creating the logger)
           const flagKey = 'custom-log-level'; // Use the same key you configured for the logger
           
           // If the log level flag changes, re-identify with the current context
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
                 clearTimeout(debounceTimer);
               }
               
               // Set a new timer to debounce multiple rapid changes
               debounceTimer = setTimeout(() => {
                 const currentContext = ldClient.getContext();
                 if (currentContext && !currentContext.anonymous) {
                   // Only re-identify if we have a non-anonymous context
                   ldClient.identify(currentContext).then(() => {
                     console.log('Context re-identified after log level change');
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
             clearTimeout(debounceTimer);
           }
         };
       }
     }, [ldClient]);
     
     return null;
   };
   ```

## Managing Context Information

To manage context information in your application:

1. Initialize the SDK with an initial context:
   ```typescript
   const initialContext: LDContext = {
     kind: 'user',
     key: 'anonymous-user',
     anonymous: true
   };
   
   <LDProvider
     clientSideID="your-client-side-id"
     context={initialContext}
     options={{ logger: logger }}
   >
     {/* Your app components */}
   </LDProvider>
   ```

2. Update the context when user information changes:
   ```typescript
   const ldClient = useLDClient();
   
   // Build a new context with user information
   const newContext: LDContext = {
     kind: 'user',
     key: 'user-123', // Required unique identifier
     name: 'John Doe', // Optional user name
     email: 'john@example.com', // Optional email
     custom: {
       role: 'admin', // Optional custom attributes
       department: 'engineering'
     }
   };
   
   // Update the client with the new context
   ldClient.identify(newContext).then(() => {
     console.log('Context updated successfully');
   });
   ```

3. Access the current context:
   ```typescript
   const ldClient = useLDClient();
   const currentContext = ldClient.getContext();
   ```

## Benefits

- **Flag-Based Logger**:
  - Dynamically change logging behavior without code changes or redeployment
  - Target different log levels to different environments or users
  - Temporarily increase logging detail for troubleshooting without affecting all users
  - Reduce log noise in production while maintaining detailed logs in development

- **Context Management**:
  - Personalize feature flag evaluations based on user attributes
  - Update context information without page reloads
  - Target features to specific user segments
  - Support anonymous users with seamless transition to identified users

## Implementation Details

The custom logger:
- Uses the SDK's default 'info' log level until the client is initialized
- Dynamically checks the feature flag value on each log call
- Adjusts which messages are displayed based on the current flag value
- Responds to flag changes in real-time without requiring SDK reinitialization
- Prevents infinite logging loops with a caching mechanism
- Filters out internal SDK messages that could cause recursion

Context management:
- Supports all standard LaunchDarkly context attributes (key, name, email, etc.)
- Allows custom attributes for advanced targeting
- Handles anonymous and identified users
- Updates flag evaluations automatically when context changes

## Preventing Infinite Logging Loops

The logger implementation includes several mechanisms to prevent infinite loops:

1. **Flag Checking Lock**: Uses a boolean flag to prevent recursive calls to `variation()` while a flag check is in progress
2. **Log Level Caching**: Caches the current log level to reduce the number of flag evaluations
3. **Time-Based Throttling**: Only checks the flag value every 5 seconds to prevent continuous flag evaluations
4. **Message Filtering**: Intelligently filters out internal SDK messages and flag evaluation results while preserving application logs
5. **Flag Change Listener**: Updates the cached log level when the flag changes, reducing the need for flag evaluations

These mechanisms ensure that the logger can safely operate even at the `debug` level without causing performance issues or infinite loops.

## Understanding Flag Evaluation Messages

When using the React SDK with debug logging enabled, you may notice periodic flag evaluation messages in the console. This is normal behavior and happens because:

1. **Proxy-Based Flag Access**: The React SDK uses JavaScript Proxies to track flag usage. When a flag value is accessed, it triggers `ldClient.variation()` to record the evaluation.

2. **JSON.stringify in Components**: When components use `JSON.stringify(flags)` (like in our FlagDisplay component), it accesses every flag property, triggering evaluations for each flag.

3. **Regular React Renders**: Each time React re-renders components that access flags, these evaluations occur again.

This behavior is by design and helps LaunchDarkly track flag usage patterns. Our logger implementation filters these internal messages while still allowing your application's debug messages to appear.

## Note on React StrictMode

In many React applications, you might see the LaunchDarkly client initialize twice in development mode due to React's StrictMode, which intentionally double-renders components to help catch potential issues.

In this example, we've disabled StrictMode to prevent this double initialization and make the logs clearer. The relevant code in `main.tsx` looks like this:

```jsx
// Removed StrictMode to prevent double initialization of the LaunchDarkly client
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <LoggerExample />
  );
}
```

If you're implementing this in your own application and prefer to use StrictMode (which is generally recommended for development), be aware that you'll see double initialization messages in the console. This is normal behavior and won't affect your application's functionality.

## License

MIT License

Copyright (c) 2025 Brad Bunce

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
