import { openSync, writeSync, closeSync, existsSync, mkdirSync } from "fs";
import { extname, dirname } from "path";

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

    // Windows equivalent for unix $HOME. Note that if $HOME environment variable exist
    // it will be used instead of USERPROFILE.
    if (process.env["USERPROFILE"] !== undefined) {
        arg = arg.replace("$HOME", process.env["USERPROFILE"]);
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
    const currentFd = openSync(path, "w");
    writeSync(currentFd, content);
    closeSync(currentFd);
}

export function writeBufferToFileSync(path: string, content: Buffer) {
    const currentFd = openSync(path, "w");
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

/**
 * Write structured logs.
 *
 * @param target
 * @param optionalParams
 */
export function debug(target: string, ...optionalParams: any[]) {
    console.log(`${new Date().toISOString()}[${target}]:`, ...optionalParams);
}

export function removeExtension(name: string) {
    const split = name.split(".");
    if (split.length === 0) {
        return name;
    } else {
        split.pop(); // drop extension
        return split.join(".");
    }
}

export function getExtension(name: string) {
    const split = name.split(".");
    if (split.length <= 1) {
        return "";
    } else {
        return "." + split[split.length - 1];
    }
}

export function createFolder(path: string) {
    if (!existsSync(path)) {
        createFolder(dirname(path));
        mkdirSync(path);
    }
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
