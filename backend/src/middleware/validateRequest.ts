// Request Validation Middleware
// Generic request validation utilities

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors.js';

// Validation schema type
export type ValidationSchema = {
  body?: Record<string, Validator>;
  params?: Record<string, Validator>;
  query?: Record<string, Validator>;
};

// Validator function type
export type Validator = (value: unknown) => boolean | string;

// Create validation middleware from schema
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schema.body) {
        validateObject(req.body, schema.body, 'body');
      }

      // Validate request params
      if (schema.params) {
        validateObject(req.params, schema.params, 'params');
      }

      // Validate request query
      if (schema.query) {
        validateObject(req.query, schema.query, 'query');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Validate object against schema
function validateObject(
  obj: Record<string, unknown>,
  schema: Record<string, Validator>,
  location: string
): void {
  for (const [key, validator] of Object.entries(schema)) {
    const value = obj[key];
    const result = validator(value);

    if (result === false) {
      throw new ValidationError(`Invalid ${location}.${key}`, { [key]: value });
    }

    if (typeof result === 'string') {
      throw new ValidationError(result, { [key]: value });
    }
  }
}

// Common validators
export const validators = {
  // Required string validator
  requiredString: (value: unknown): boolean | string => {
    if (typeof value !== 'string') {
      return 'Value must be a string';
    }
    if (value.trim().length === 0) {
      return 'Value cannot be empty';
    }
    return true;
  },

  // Optional string validator
  optionalString: (value: unknown): boolean | string => {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value !== 'string') {
      return 'Value must be a string';
    }
    return true;
  },

  // String with max length validator
  maxLength:
    (max: number) =>
    (value: unknown): boolean | string => {
      if (typeof value !== 'string') {
        return 'Value must be a string';
      }
      if (value.length > max) {
        return `Value must be at most ${max} characters`;
      }
      return true;
    },

  // Enum validator
  oneOf:
    <T>(values: T[]) =>
    (value: unknown): boolean | string => {
      if (!values.includes(value as T)) {
        return `Value must be one of: ${values.join(', ')}`;
      }
      return true;
    },

  // Combine validators (all must pass)
  combine:
    (...validators: Validator[]) =>
    (value: unknown): boolean | string => {
      for (const validator of validators) {
        const result = validator(value);
        if (result !== true) {
          return result;
        }
      }
      return true;
    },
};
