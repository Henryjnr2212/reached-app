import { log } from '../_shared/log.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { createHandler } from './handler.ts';

Deno.serve(createHandler({ db: serviceClient(), log }));
