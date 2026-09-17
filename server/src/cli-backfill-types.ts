import { backfillElementTypes, openDb } from './db/index';
import { paths } from './paths';

/** M31: one-off for databases that gained the type column before the backfill existed. Safe to rerun. */
const db = openDb(paths.db);
const changed = backfillElementTypes(db);
console.log(`Typed ${changed} element(s) from their slugs in ${paths.db}`);
db.close();
