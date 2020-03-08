
import { closeSync, existsSync, openSync, writeSync } from 'fs';
const rimraf = require('rimraf');

/**
 * Recursive remove
 */
export function recursiveRemoveDirectory(path: string) {
    if (existsSync(path)) {
        rimraf.sync(path);
    }
}

export function writeFile(path: string, content: string) {
    let currentFd = openSync(path, 'w');
    writeSync(currentFd, content);
    closeSync(currentFd);
}
