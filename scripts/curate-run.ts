// Chay thu cac nguon tim noi dung: npx tsx --conditions=react-server --env-file=.env scripts/curate-run.ts
import { listSources, runSource } from "../src/modules/curate/store";

async function main() {
  for (const s of await listSources()) {
    if (!s.active) continue;
    const r = await runSource(s);
    console.log(`#${s.id} ${s.name}: ${r.message}`);
  }
  process.exit(0);
}
void main();
