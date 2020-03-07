
import { closeSync, existsSync, lstatSync, openSync, readdirSync, rmdirSync, unlinkSync, writeSync } from 'fs';
import { join } from 'path';

/**
 * Recursive remove
 */
export function recursiveRemoveDirectory(path: string) {
    if (existsSync(path)) {
        readdirSync(path).forEach(name => {
            let cPath = join(path, name);
            let cPathStat = lstatSync(cPath);

            if (cPathStat.isFile()) {
                unlinkSync(cPath);
            } else if (cPathStat.isDirectory()) {
                recursiveRemoveDirectory(cPath);
            } else {
                throw Error(`Error removing ${cPath} | stat: ${cPathStat}`);
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
