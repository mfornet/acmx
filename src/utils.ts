import { openSync, writeSync, closeSync } from "fs-extra";
import { extname } from "path";

/**
 * Substitute argument from a command list with relevant values.
 *
 * Make substitution for:
 * - $CODE
 * - $OUTPUT
 * - $ATTIC
 * - $HOME
 *
 * @param args List of arguments.
 * @param code $CODE
 * @param output $OUTPUT
 * @param attic $ATTIC
 */
export function substituteArgWith(
    arg: string,
    code?: string,
    output?: string,
    attic?: string
) {
    if (code !== undefined) {
        arg = arg.replace("$CODE", code);
    }

    if (output !== undefined) {
        arg = arg.replace("$OUTPUT", output);
    }

    if (attic !== undefined) {
        arg = arg.replace("$ATTIC", attic);
    }

    if (process.env["HOME"] !== undefined) {
        arg = arg.replace("$HOME", process.env["HOME"]);
    }

    return arg;
}

/**
 * Substitute arguments from a command list with relevant values.
 */
export function substituteArgsWith(
    args: string[],
    code?: string,
    output?: string,
    attic?: string
) {
    return args.map((arg) => {
        return substituteArgWith(arg, code, output, attic);
    });
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
