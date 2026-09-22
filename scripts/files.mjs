import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
/** Deterministic source discovery; never follows symlinks outside the tree. */
export function* walkFiles(dir, pattern) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, {withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name))) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) yield* walkFiles(file, pattern);
        else if (entry.isFile() && pattern.test(entry.name)) yield file;
    }
}
