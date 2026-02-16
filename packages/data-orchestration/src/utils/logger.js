"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const pino_1 = __importDefault(require("pino"));
function isNextBuild() {
    const argv = process.argv ?? [];
    const argvString = argv.join(' ');
    return (argv.includes('build') ||
        argvString.includes(' next build') ||
        argvString.includes('next build') ||
        argvString.includes('next/dist/bin/next build') ||
        argvString.includes('next/dist/build'));
}
function isBuildPhase() {
    const lifecycleEvent = process.env.npm_lifecycle_event;
    const lifecycleScript = process.env.npm_lifecycle_script ?? '';
    return (isNextBuild() ||
        lifecycleEvent === 'build' ||
        lifecycleScript.includes('next build') ||
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NEXT_BUILD === 'true');
}
function createLogger(name, options = {}) {
    const level = isBuildPhase() ? 'silent' : options.level ?? process.env.LOG_LEVEL ?? 'info';
    return (0, pino_1.default)({ ...options, name, level });
}
