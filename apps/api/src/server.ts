// Bootstrap file to ensure tsconfig path aliases (e.g., utils/*) are resolved at runtime
// before loading the main server implementation.
// This avoids MODULE_NOT_FOUND for compiled CJS output.
require('tsconfig-paths/register');
require('./index');
