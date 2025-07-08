import Joi from "joi";
import { BadRequestError } from "../utils/apiError.js";

/**
 * Middleware to validate request body, params or query using Joi schema
 * @param {Joi.ObjectSchema} schema - Joi schema to validate against
 * @param {'body'|'params'|'query'} property - The request property to validate
 */
export const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return next(new BadRequestError("Validation error", errors));
    }

    req[property] = value;
    next();
  };
};
