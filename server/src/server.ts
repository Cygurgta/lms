import { app } from './app.js'; import { env } from './config/env.js'; app.listen(env.port,()=>console.log(`Rhyme LMS API listening on :${env.port}`));
