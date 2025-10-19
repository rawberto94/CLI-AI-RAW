import pino from "pino";

const logger = pino({ name: "expression-parser" });

/**
 * Safe expression parser - replaces eval() for condition evaluation
 * Supports basic comparison and logical operations without code execution risk
 */

type ComparisonOperator = "===" | "!==" | "==" | "!=" | ">" | "<" | ">=" | "<=";
type LogicalOperator = "&&" | "||";

interface ParsedExpression {
  left: string;
  operator: ComparisonOperator;
  right: string;
}

/**
 * Safely evaluate a condition expression without using eval()
 * Supports: comparisons (===, !==, >, <, >=, <=) and logical operators (&&, ||)
 */
export function safeEvaluateCondition(
  expression: string,
  context: Record<string, any>
): boolean {
  try {
    // Trim whitespace
    expression = expression.trim();

    // Handle empty or simple boolean values
    if (expression === "true") return true;
    if (expression === "false") return false;

    // Replace context variables
    let evaluatedExpression = expression;
    Object.entries(context).forEach(([key, value]) => {
      // Escape special regex characters in key
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\$\\{${escapedKey}\\}`, "g");
      evaluatedExpression = evaluatedExpression.replace(
        regex,
        JSON.stringify(value)
      );
    });

    // Handle logical operators (&&, ||)
    // Split only on operators outside of quoted strings
    if (evaluatedExpression.includes("&&")) {
      const parts = splitOnOperatorOutsideQuotes(evaluatedExpression, "&&");
      return parts.every((part) => evaluateSimpleExpression(part));
    }

    if (evaluatedExpression.includes("||")) {
      const parts = splitOnOperatorOutsideQuotes(evaluatedExpression, "||");
      return parts.some((part) => evaluateSimpleExpression(part));
    }

    // Evaluate simple expression
    return evaluateSimpleExpression(evaluatedExpression);
  } catch (error) {
    logger.warn(
      { expression, error },
      "Failed to evaluate condition, defaulting to true"
    );
    return true;
  }
}

/**
 * Split expression on operator, but only outside of quoted strings
 */
function splitOnOperatorOutsideQuotes(
  expression: string,
  operator: string
): string[] {
  const parts: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];
    const nextChars = expression.substring(i, i + operator.length);

    // Toggle quote state
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      i++;
      continue;
    }

    // Check for operator outside quotes
    if (!inSingleQuote && !inDoubleQuote && nextChars === operator) {
      parts.push(current.trim());
      current = "";
      i += operator.length;
      continue;
    }

    current += char;
    i++;
  }

  // Add remaining part
  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.length > 0 ? parts : [expression];
}

/**
 * Evaluate a simple comparison expression (no logical operators)
 */
function evaluateSimpleExpression(expression: string): boolean {
  expression = expression.trim();

  // Try to parse as comparison
  const parsed = parseComparison(expression);
  if (!parsed) {
    // If not a comparison, try to parse as boolean
    return parseBoolean(expression);
  }

  const { left, operator, right } = parsed;

  // Parse values
  const leftValue = parseValue(left);
  const rightValue = parseValue(right);

  // Perform comparison
  return compare(leftValue, operator, rightValue);
}

/**
 * Parse a comparison expression into components
 */
function parseComparison(expression: string): ParsedExpression | null {
  const operators: ComparisonOperator[] = [
    "===",
    "!==",
    "==",
    "!=",
    ">=",
    "<=",
    ">",
    "<",
  ];

  for (const operator of operators) {
    const index = expression.indexOf(operator);
    if (index !== -1) {
      return {
        left: expression.substring(0, index).trim(),
        operator,
        right: expression.substring(index + operator.length).trim(),
      };
    }
  }

  return null;
}

/**
 * Parse a value from string to appropriate type
 */
function parseValue(value: string): any {
  value = value.trim();

  // Remove quotes if present
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  // Try to parse as number (but not Infinity)
  const num = Number(value);
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }

  // Try to parse as boolean
  if (value === "true") return true;
  if (value === "false") return false;

  // Try to parse as null/undefined
  if (value === "null") return null;
  if (value === "undefined") return undefined;

  // Try to parse as JSON (for objects/arrays)
  try {
    return JSON.parse(value);
  } catch {
    // Return as string if all else fails
    return value;
  }
}

/**
 * Parse a boolean value
 */
function parseBoolean(value: string): boolean {
  value = value.trim().toLowerCase();

  if (value === "true") return true;
  if (value === "false") return false;

  // Try to parse as truthy/falsy
  try {
    const parsed = parseValue(value);
    return Boolean(parsed);
  } catch {
    return false;
  }
}

/**
 * Compare two values using the specified operator
 */
function compare(
  left: any,
  operator: ComparisonOperator,
  right: any
): boolean {
  switch (operator) {
    case "===":
      return left === right;
    case "!==":
      return left !== right;
    case "==":
      // eslint-disable-next-line eqeqeq
      return left == right;
    case "!=":
      // eslint-disable-next-line eqeqeq
      return left != right;
    case ">":
      return left > right;
    case "<":
      return left < right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    default:
      logger.warn({ operator }, "Unknown comparison operator");
      return false;
  }
}

/**
 * Validate that an expression is safe (no function calls, no code execution)
 */
export function validateExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  // Check for dangerous patterns
  const dangerousPatterns = [
    /\beval\b/,
    /\bFunction\b/,
    /\brequire\b/,
    /\bimport\b/,
    /\bprocess\b/,
    /\b__dirname\b/,
    /\b__filename\b/,
    /\[\s*["'].*["']\s*\]/, // Bracket notation access
    /\.\s*constructor/,
    /\.\s*prototype/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      return {
        valid: false,
        error: `Expression contains potentially dangerous pattern: ${pattern}`,
      };
    }
  }

  return { valid: true };
}
