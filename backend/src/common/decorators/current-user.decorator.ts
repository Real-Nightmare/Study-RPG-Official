import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Injects the authenticated user (or a single claim of it) into a handler.
 * The payload is attached to the request by the JWT strategy during guard
 * activation; when no user is present the decorator resolves to null.
 */
export const CurrentUser = createParamDecorator(
  (claim: keyof JwtPayload | undefined, context: ExecutionContext): JwtPayload | unknown => {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      return null;
    }

    return claim ? user[claim] : user;
  },
);
