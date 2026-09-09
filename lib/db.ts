import { env } from 'cloudflare:workers';
export function db(): D1Database {return (env as unknown as {DB:D1Database}).DB;}
export function sameOrigin(r:Request){const o=r.headers.get('origin');return !o||o===new URL(r.url).origin;}
