import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const sendOTPSchecma = Joi.object({
  email: Joi.string().email().required(),
});
export const verifyOTPSchecma = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().required(),
});
export const verifyForgotOTP = Joi.object({
  code: Joi.string().required(),
});
export const updatePassword = Joi.object({
  newPassword: Joi.string().required(),
});
export const refreshToken = Joi.object({
  refreshToken: Joi.string().required(),
});
