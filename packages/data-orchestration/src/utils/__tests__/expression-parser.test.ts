import { safeEvaluateCondition, validateExpression } from '../expression-parser';

describe('Expression Parser', () => {
  describe('safeEvaluateCondition', () => {
    describe('Simple comparisons', () => {
      it('should evaluate strict equality', () => {
        expect(safeEvaluateCondition('"test" === "test"', {})).toBe(true);
        expect(safeEvaluateCondition('"test" === "other"', {})).toBe(false);
        expect(safeEvaluateCondition('5 === 5', {})).toBe(true);
        expect(safeEvaluateCondition('5 === 6', {})).toBe(false);
      });

      it('should evaluate strict inequality', () => {
        expect(safeEvaluateCondition('"test" !== "other"', {})).toBe(true);
        expect(safeEvaluateCondition('"test" !== "test"', {})).toBe(false);
      });

      it('should evaluate greater than', () => {
        expect(safeEvaluateCondition('10 > 5', {})).toBe(true);
        expect(safeEvaluateCondition('5 > 10', {})).toBe(false);
        expect(safeEvaluateCondition('5 > 5', {})).toBe(false);
      });

      it('should evaluate less than', () => {
        expect(safeEvaluateCondition('5 < 10', {})).toBe(true);
        expect(safeEvaluateCondition('10 < 5', {})).toBe(false);
        expect(safeEvaluateCondition('5 < 5', {})).toBe(false);
      });

      it('should evaluate greater than or equal', () => {
        expect(safeEvaluateCondition('10 >= 5', {})).toBe(true);
        expect(safeEvaluateCondition('5 >= 5', {})).toBe(true);
        expect(safeEvaluateCondition('5 >= 10', {})).toBe(false);
      });

      it('should evaluate less than or equal', () => {
        expect(safeEvaluateCondition('5 <= 10', {})).toBe(true);
        expect(safeEvaluateCondition('5 <= 5', {})).toBe(true);
        expect(safeEvaluateCondition('10 <= 5', {})).toBe(false);
      });
    });

    describe('Context variable substitution', () => {
      it('should substitute context variables', () => {
        const context = { status: 'COMPLETED', count: 10 };
        
        expect(safeEvaluateCondition('${status} === "COMPLETED"', context)).toBe(true);
        expect(safeEvaluateCondition('${count} > 5', context)).toBe(true);
        expect(safeEvaluateCondition('${count} < 5', context)).toBe(false);
      });

      it('should handle multiple variables', () => {
        const context = { status: 'ACTIVE', priority: 5 };
        
        expect(
          safeEvaluateCondition('${status} === "ACTIVE" && ${priority} >= 5', context)
        ).toBe(true);
      });
    });

    describe('Logical operators', () => {
      it('should evaluate AND operator', () => {
        expect(safeEvaluateCondition('true && true', {})).toBe(true);
        expect(safeEvaluateCondition('true && false', {})).toBe(false);
        expect(safeEvaluateCondition('false && true', {})).toBe(false);
        expect(safeEvaluateCondition('false && false', {})).toBe(false);
      });

      it('should evaluate OR operator', () => {
        expect(safeEvaluateCondition('true || true', {})).toBe(true);
        expect(safeEvaluateCondition('true || false', {})).toBe(true);
        expect(safeEvaluateCondition('false || true', {})).toBe(true);
        expect(safeEvaluateCondition('false || false', {})).toBe(false);
      });

      it('should evaluate complex logical expressions', () => {
        const context = { status: 'ACTIVE', count: 10, priority: 3 };
        
        expect(
          safeEvaluateCondition(
            '${status} === "ACTIVE" && ${count} > 5',
            context
          )
        ).toBe(true);
        
        expect(
          safeEvaluateCondition(
            '${priority} >= 5 || ${count} > 5',
            context
          )
        ).toBe(true);
        
        expect(
          safeEvaluateCondition(
            '${priority} >= 5 && ${count} < 5',
            context
          )
        ).toBe(false);
      });
    });

    describe('Boolean values', () => {
      it('should handle simple boolean values', () => {
        expect(safeEvaluateCondition('true', {})).toBe(true);
        expect(safeEvaluateCondition('false', {})).toBe(false);
      });

      it('should handle empty expressions', () => {
        expect(safeEvaluateCondition('', {})).toBe(true);
        expect(safeEvaluateCondition(undefined, {})).toBe(true);
      });
    });

    describe('Error handling', () => {
      it('should default to true on invalid expressions', () => {
        expect(safeEvaluateCondition('invalid expression', {})).toBe(true);
      });

      it('should handle missing context variables gracefully', () => {
        // Missing variables will be replaced with "undefined" string
        expect(safeEvaluateCondition('${missing} === "undefined"', {})).toBe(true);
      });
    });

    describe('Type handling', () => {
      it('should handle null values', () => {
        const context = { value: null };
        expect(safeEvaluateCondition('${value} === null', context)).toBe(true);
      });

      it('should handle numbers', () => {
        const context = { count: 42 };
        expect(safeEvaluateCondition('${count} === 42', context)).toBe(true);
        expect(safeEvaluateCondition('${count} > 40', context)).toBe(true);
      });

      it('should handle strings with quotes', () => {
        expect(safeEvaluateCondition('"hello" === "hello"', {})).toBe(true);
        expect(safeEvaluateCondition("'hello' === 'hello'", {})).toBe(true);
      });
    });
  });

  describe('validateExpression', () => {
    it('should accept safe expressions', () => {
      const result = validateExpression('${status} === "COMPLETED"');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject eval', () => {
      const result = validateExpression('eval("malicious code")');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous');
    });

    it('should reject Function constructor', () => {
      const result = validateExpression('Function("return 1")()');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous');
    });

    it('should reject require', () => {
      const result = validateExpression('require("fs")');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous');
    });

    it('should reject process access', () => {
      const result = validateExpression('process.exit(1)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous');
    });

    it('should reject constructor access', () => {
      const result = validateExpression('obj.constructor');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous');
    });

    it('should reject prototype access', () => {
      const result = validateExpression('obj.prototype');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('dangerous');
    });
  });
});
