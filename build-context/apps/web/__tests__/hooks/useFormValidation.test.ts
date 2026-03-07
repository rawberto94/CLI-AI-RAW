/**
 * Unit Tests for useFormValidation Hook
 * Tests for hooks/useFormValidation.ts
 */

import { describe, it, expect, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { z } from 'zod';

// Test schema
const testSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

describe('useFormValidation', () => {
  describe('initialization', () => {
    it('should initialize with default values', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      expect(result.current.values.email).toBe('');
      expect(result.current.values.password).toBe('');
      expect(result.current.values.confirmPassword).toBe('');
      expect(result.current.isValid).toBe(false);
      expect(result.current.isDirty).toBe(false);
    });

    it('should initialize with provided default values', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: 'test@example.com',
            password: 'password123',
            confirmPassword: 'password123',
          },
        })
      );

      expect(result.current.values.email).toBe('test@example.com');
      expect(result.current.values.password).toBe('password123');
    });
  });

  describe('validation', () => {
    it('should validate email field', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
          validateOnChange: true,
        })
      );

      // Set invalid email
      act(() => {
        result.current.setFieldValue('email', 'invalid-email');
        result.current.touchField('email');
      });

      await waitFor(() => {
        expect(result.current.errors.email).toBe('Invalid email');
      });

      // Set valid email
      act(() => {
        result.current.setFieldValue('email', 'valid@example.com');
      });

      await waitFor(() => {
        expect(result.current.errors.email).toBeUndefined();
      });
    });

    it('should validate password length', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
          validateOnChange: true,
        })
      );

      // Set short password
      act(() => {
        result.current.setFieldValue('password', 'short');
        result.current.touchField('password');
      });

      await waitFor(() => {
        expect(result.current.errors.password).toBe('Password must be at least 8 characters');
      });

      // Set valid password
      act(() => {
        result.current.setFieldValue('password', 'validpassword123');
      });

      await waitFor(() => {
        expect(result.current.errors.password).toBeUndefined();
      });
    });

    it('should validate password confirmation', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: 'test@example.com',
            password: 'password123',
            confirmPassword: '',
          },
          validateOnChange: true,
        })
      );

      // Set mismatching confirm password
      act(() => {
        result.current.setFieldValue('confirmPassword', 'different');
        result.current.touchField('confirmPassword');
      });

      await waitFor(() => {
        expect(result.current.errors.confirmPassword).toBe('Passwords must match');
      });

      // Set matching confirm password
      act(() => {
        result.current.setFieldValue('confirmPassword', 'password123');
      });

      await waitFor(() => {
        expect(result.current.errors.confirmPassword).toBeUndefined();
      });
    });
  });

  describe('form state', () => {
    it('should track dirty state', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setFieldValue('email', 'new@example.com');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('should track touched fields', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      expect(result.current.touched.email).toBeFalsy();

      act(() => {
        result.current.touchField('email');
      });

      expect(result.current.touched.email).toBe(true);
    });

    it('should report valid state correctly', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      expect(result.current.isValid).toBe(false);

      act(() => {
        result.current.setFieldValue('email', 'test@example.com');
        result.current.setFieldValue('password', 'validpassword123');
        result.current.setFieldValue('confirmPassword', 'validpassword123');
      });

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
      });
    });
  });

  describe('getFieldProps', () => {
    it('should return field props for input binding', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: 'test@example.com',
            password: '',
            confirmPassword: '',
          },
        })
      );

      const emailProps = result.current.getFieldProps('email');

      expect(emailProps.value).toBe('test@example.com');
      expect(emailProps.name).toBe('email');
      expect(typeof emailProps.onChange).toBe('function');
      expect(typeof emailProps.onBlur).toBe('function');
    });

    it('should update value on change event', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      const emailProps = result.current.getFieldProps('email');

      act(() => {
        emailProps.onChange({ target: { value: 'new@example.com' } } as React.ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.values.email).toBe('new@example.com');
    });

    it('should mark field as touched on blur', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      const emailProps = result.current.getFieldProps('email');

      act(() => {
        emailProps.onBlur();
      });

      expect(result.current.touched.email).toBe(true);
    });
  });

  describe('handleSubmit', () => {
    it('should call onSubmit with values when valid', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      const onSubmit = jest.fn();
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: 'test@example.com',
            password: 'validpassword123',
            confirmPassword: 'validpassword123',
          },
        })
      );

      await act(async () => {
        await result.current.handleSubmit(onSubmit)();
      });

      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'validpassword123',
        confirmPassword: 'validpassword123',
      });
    });

    it('should not call onSubmit when invalid', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      const onSubmit = jest.fn();
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: 'invalid-email',
            password: 'short',
            confirmPassword: 'different',
          },
        })
      );

      await act(async () => {
        await result.current.handleSubmit(onSubmit)();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should touch all fields on submit', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      const onSubmit = jest.fn();
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      expect(result.current.touched.email).toBeFalsy();
      expect(result.current.touched.password).toBeFalsy();

      await act(async () => {
        await result.current.handleSubmit(onSubmit)();
      });

      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.password).toBe(true);
      expect(result.current.touched.confirmPassword).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset form to default values', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      // Modify values
      act(() => {
        result.current.setFieldValue('email', 'test@example.com');
        result.current.setFieldValue('password', 'password123');
        result.current.touchField('email');
      });

      expect(result.current.values.email).toBe('test@example.com');
      expect(result.current.isDirty).toBe(true);
      expect(result.current.touched.email).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.values.email).toBe('');
      expect(result.current.values.password).toBe('');
      expect(result.current.isDirty).toBe(false);
      expect(result.current.touched.email).toBe(false);
    });

    it('should reset to provided values', async () => {
      const { useFormValidation } = await import('@/hooks/useFormValidation');
      
      const { result } = renderHook(() => 
        useFormValidation({
          schema: testSchema,
          defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
          },
        })
      );

      act(() => {
        result.current.reset({
          email: 'new@example.com',
          password: 'newpassword',
          confirmPassword: 'newpassword',
        });
      });

      expect(result.current.values.email).toBe('new@example.com');
      expect(result.current.values.password).toBe('newpassword');
    });
  });
});
