
import { closeSync, existsSync, openSync, readdirSync, rmdirSync, unlinkSync, writeSync } from 'fs';
import { join } from 'path';

/**
 * Recursive remove
 */
export function recRmdir(path: string) {
    if (existsSync(path)) {
        readdirSync(path).forEach(name => {
            let cPath = join(path, name);

            try {
                unlinkSync(cPath);
            }
            catch (err) {
                recRmdir(cPath);
            }
        });

        rmdirSync(path);
    }
}

export function writeFile(path: string, content: string) {
    let currentFd = openSync(path, 'w');
    writeSync(currentFd, content);
    closeSync(currentFd);
}
