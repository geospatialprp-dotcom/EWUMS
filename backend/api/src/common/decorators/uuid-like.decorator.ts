import { Matches } from 'class-validator';

/** Accepts seeded/demo UUIDs that may not pass strict RFC @IsUUID() (e.g. d1000000-0000-0000-0000-000000000010). */
export const IsUuidLike = () =>
  Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'must be a UUID',
  });
