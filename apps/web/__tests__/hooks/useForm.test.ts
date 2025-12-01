/**
 * Tests for useForm hook
 * @see /hooks/useForm.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm, validators } from '../../hooks/useForm';

describe('useForm', () => {
  describe('initialization', () => {
    it('should initialize with config values', () => {
      const { result } = renderHook(() =>
        useForm({
          config: {
            name: '',
            email: '',
          },
        })
      );

      expect(result.current.state.values).toEqual({ name: '', email: '' });
      expect(result.current.state.errors).toEqual({});
      expect(result.current.state.touched).toEqual({});
      expect(result.current.state.isDirty).toBe(false);
      expect(result.current.state.isSubmitting).toBe(false);
    });

    it('should initialize with field config objects', () => {
      const { result } = renderHook(() =>
        useForm({
          config: {
            name: { initialValue: 'John' },
            age: { initialValue: 30 },
          },
        })
      );

      expect(result.current.state.values.name).toBe('John');
      expect(result.current.state.values.age).toBe(30);
    });
  });

  describe('setValue', () => {
    it('should update a single field', () => {
      const { result } = renderHook(() =>
        useForm({
          config: { name: '', email: '' },
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
      });

      expect(result.current.state.values.name).toBe('John');
      expect(result.current.state.isDirty).toBe(true);
    });
  });

  describe('setValues', () => {
    it('should update multiple fields', () => {
      const { result } = renderHook(() =>
        useForm({
          config: { name: '', email: '', age: 0 },
        })
      );

      act(() => {
        result.current.setValues({
          name: 'John',
          email: 'john@example.com',
        });
      });

      expect(result.current.state.values.name).toBe('John');
      expect(result.current.state.values.email).toBe('john@example.com');
      expect(result.current.state.values.age).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset to initial values', () => {
      const { result } = renderHook(() =>
        useForm({
          config: { name: '', email: '' },
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setValue('email', 'john@example.com');
      });

      expect(result.current.state.isDirty).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.values).toEqual({ name: '', email: '' });
      expect(result.current.state.isDirty).toBe(false);
    });
  });

  describe('register', () => {
    it('should return input props', () => {
      const { result } = renderHook(() =>
        useForm({
          config: { name: '' },
        })
      );

      const props = result.current.register('name');

      expect(props.name).toBe('name');
      expect(props.value).toBe('');
      expect(typeof props.onChange).toBe('function');
      expect(typeof props.onBlur).toBe('function');
    });
  });

  describe('validators', () => {
    it('should validate required fields', () => {
      expect(validators.required()('')).toBe('This field is required');
      expect(validators.required()('value')).toBeUndefined();
    });

    it('should validate minLength', () => {
      expect(validators.minLength(5)('abc')).toBe('Must be at least 5 characters');
      expect(validators.minLength(5)('abcdef')).toBeUndefined();
    });

    it('should validate maxLength', () => {
      expect(validators.maxLength(5)('abcdef')).toBe('Must be at most 5 characters');
      expect(validators.maxLength(5)('abc')).toBeUndefined();
    });

    it('should validate email', () => {
      expect(validators.email()('invalid')).toBe('Invalid email address');
      expect(validators.email()('test@example.com')).toBeUndefined();
    });

    it('should validate min number', () => {
      expect(validators.min(5)(3)).toBe('Must be at least 5');
      expect(validators.min(5)(5)).toBeUndefined();
    });

    it('should validate max number', () => {
      expect(validators.max(5)(10)).toBe('Must be at most 5');
      expect(validators.max(5)(5)).toBeUndefined();
    });

    it('should validate pattern', () => {
      expect(validators.pattern(/^\d+$/, 'Numbers only')('abc')).toBe('Numbers only');
      expect(validators.pattern(/^\d+$/, 'Numbers only')('123')).toBeUndefined();
    });
  });
});
