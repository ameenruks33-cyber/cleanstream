export class AuthError extends Error {
  code = 'UNAUTHENTICATED'
  constructor(message = 'Sign in required.') {
    super(message)
    this.name = 'AuthError'
  }
}

export function resolveAuthenticatedUserId(
  authUserId: string | null | undefined,
  claimedUserId?: string | null,
): string {
  void claimedUserId
  if (!authUserId) {
    throw new AuthError()
  }
  return authUserId
}
