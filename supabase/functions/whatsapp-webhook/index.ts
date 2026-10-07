import { log } from '../_shared/log.ts';
import { backgroundRunner, serviceClient } from '../_shared/supabase.ts';
import { createHandler } from './handler.ts';

const env = Deno.env.toObject();
Deno.serve(createHandler({ db: serviceClient(env), env, fetch, log, background: backgroundRunner() }));
