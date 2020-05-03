import { openSync, writeSync, closeSync } from "fs-extra";
import { extname } from "path";

function isAlphaNumeric(char: String) {
    let code = char.charCodeAt(0);
    return (
        (48 <= code && code <= 57) ||
        (65 <= code && code <= 90) ||
        (97 <= code && code <= 122) ||
        code == 95
    );
}

// TODO(now) Only substitute HOME
export function substituteWith(pattern: String, dic: any) {
    let resPattern = "";

    for (let i = 0, j = 0; i < pattern.length; i = j) {
        if (pattern[i] == "$") {
            let token = "";
            for (
                j = i + 1;
                j < pattern.length && isAlphaNumeric(pattern[j]);
                j++
            ) {
                token += pattern[j];
            }

            resPattern += dic[token];
        } else {
            resPattern += pattern[i];
            j = i + 1;
        }
    }
    return resPattern;
}

export function writeToFileSync(path: string, content: string) {
    let currentFd = openSync(path, "w");
    writeSync(currentFd, content);
    closeSync(currentFd);
}

/**
 * Find extension from target file.
 *
 * @param file Target
 */
export function extension(file: string) {
    return extname(file).slice(1);
}
