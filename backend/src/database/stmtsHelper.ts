import { getDb } from './index.js';
import { getStatements } from './statements.js';

export function getStmts(): ReturnType<typeof getStatements> {
  return getStatements(getDb());
}
