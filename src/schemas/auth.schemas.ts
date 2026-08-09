import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().trim().toLowerCase().max(255),
    password: z.string().min(8).max(72),
  }).strict(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email().trim().toLowerCase().max(255),
    password: z.string().min(1).max(72),
  }).strict(),
});
