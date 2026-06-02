#!/usr/bin/env node
/**
 * Production server entry point.
 * Wraps dev-server.js which supports both dev and production modes.
 * This file exists for Docker compatibility (docs reference server.js).
 */
require('./dev-server.js');
