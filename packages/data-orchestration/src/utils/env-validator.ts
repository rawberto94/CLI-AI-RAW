import pino from "pino";

const logger = pino({ name: "env-validator" });

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

const ENV_VARIABLES: EnvConfig[] = [
  // Database
  { name: "DATABASE_URL", required: true, description: "PostgreSQL connection string" },
  
  // Redis
  { name: "REDIS_URL", required: true, description: "Redis connection string" },
  
  // OpenAI
  { name: "OPENAI_API_KEY", required: true, description: "OpenAI API key for AI features" },
  
  // Authentication
  { name: "NEXTAUTH_SECRET", required: true, description: "NextAuth secret for session encryption" },
  { name: "NEXTAUTH_URL", required: false, description: "NextAuth URL", defaultValue: "http://localhost:3000" },
  
  // Application
  { name: "NODE_ENV", required: false, description: "Node environment", defaultValue: "development" },
  
  // Optional Services
  { name: "PINECONE_API_KEY", required: false, description: "Pinecone API key for vector search" },
  { name: "PINECONE_ENVIRONMENT", required: false, description: "Pinecone environment" },
  { name: "PINECONE_INDEX", required: false, description: "Pinecone index name" },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
}

/**
 * Validate environment variables at startup
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];

  for (const config of ENV_VARIABLES) {
    const value = process.env[config.name];

    if (!value || value.trim() === "") {
      if (config.required) {
        errors.push(
          `Missing required environment variable: ${config.name} - ${config.description}`
        );
        missing.push(config.name);
      } else {
        warnings.push(
          `Optional environment variable not set: ${config.name} - ${config.description}${
            config.defaultValue ? ` (using default: ${config.defaultValue})` : ""
          }`
        );
        
        // Set default value if provided
        if (config.defaultValue) {
          process.env[config.name] = config.defaultValue;
        }
      }
    }
  }

  const valid = errors.length === 0;

  if (!valid) {
    logger.error(
      { errors, missing },
      "Environment validation failed - missing required variables"
    );
  }

  if (warnings.length > 0) {
    logger.warn({ warnings }, "Environment validation warnings");
  }

  if (valid) {
    logger.info("Environment validation passed");
  }

  return {
    valid,
    errors,
    warnings,
    missing,
  };
}

/**
 * Validate and throw if invalid (for startup)
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    const errorMessage = [
      "❌ Environment validation failed!",
      "",
      "Missing required environment variables:",
      ...result.errors.map((e) => `  - ${e}`),
      "",
      "Please check your .env file and ensure all required variables are set.",
      "See .env.example for reference.",
    ].join("\n");

    throw new Error(errorMessage);
  }
}

/**
 * Get a required environment variable or throw
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Required environment variable ${name} is not set. Check your .env file.`
    );
  }
  return value;
}

/**
 * Get an optional environment variable with default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}
