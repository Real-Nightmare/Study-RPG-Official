import { SetMetadata } from '@nestjs/common';

export enum Role {
  USER = 'user',
  PREMIUM = 'premium',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

export const ROLES_KEY = 'roles';

/** Declares which roles may access the decorated route. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
