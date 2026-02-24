import { z } from 'zod';
export const UserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string().email(),
});
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
