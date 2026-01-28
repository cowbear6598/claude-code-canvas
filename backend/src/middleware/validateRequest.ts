import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors.js';

export type ValidationSchema = {
  body?: Record<string, Validator>;
  params?: Record<string, Validator>;
  query?: Record<string, Validator>;
};

export type Validator = (value: unknown) => boolean | string;

export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        validateObject(req.body, schema.body, 'body');
      }

      if (schema.params) {
        validateObject(req.params, schema.params, 'params');
      }

      if (schema.query) {
        validateObject(req.query, schema.query, 'query');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

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

export const validators = {
  requiredString: (value: unknown): boolean | string => {
    if (typeof value !== 'string') {
      return 'Value must be a string';
    }
    if (value.trim().length === 0) {
      return 'Value cannot be empty';
    }
    return true;
  },

  optionalString: (value: unknown): boolean | string => {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value !== 'string') {
      return 'Value must be a string';
    }
    return true;
  },

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

  oneOf:
    <T>(values: T[]) =>
    (value: unknown): boolean | string => {
      if (!values.includes(value as T)) {
        return `Value must be one of: ${values.join(', ')}`;
      }
      return true;
    },

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
