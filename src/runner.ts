import { spawnSync } from "child_process";
import { Execution, LanguageCommand, Option, ATTIC } from "./primitives";
import { globalLanguagePath } from "./core";
import { join, basename } from "path";
import { readdirSync, readFileSync, existsSync } from "fs";
import { extension, substituteArgsWith, debug, writeToFileSync } from "./utils";
import { onCompilationError, showCompileError } from "./errors";
import md5File = require("md5-file");

function loadConfig(extension: string): LanguageCommand {
    const languagesPath = globalLanguagePath();
    const candidates: string[] = [];

    const filtered = readdirSync(languagesPath).filter((file) => {
        try {
            const content = readFileSync(join(languagesPath, file), "utf8");
            const language = JSON.parse(content);

            if (language.ext === extension) {
                return true;
            } else {
                candidates.push(language.ext);
                return false;
            }
        } catch {
            return false;
        }
    });

    if (filtered.length === 0) {
        throw new Error(
            `Configuration not found for extension ${extension}. Candidates are: ${candidates.join(
                ","
            )}`
        );
    }

    const languagePath = join(languagesPath, filtered[0]);
    const content = readFileSync(languagePath, "utf8");
    const language = JSON.parse(content);
    return new LanguageCommand(language.run || [], language.preRun || []);
}

/**
 * Check if code was already compiled
 */
function checkMD5(code: string, path: string): boolean {
    const pathMD5 = join(path, ATTIC, basename(code)) + ".md5";
    let storedMD5 = "";
    if (existsSync(pathMD5)) {
        storedMD5 = readFileSync(pathMD5, "utf8");
    }
    const currentMD5 = md5File.sync(code);
    return currentMD5 === storedMD5;
}

/**
 * Copy MD5 from current file into a folder to avoid compiling again.
 */
function dumpMD5(code: string, path: string) {
    const pathMD5 = join(path, ATTIC, basename(code)) + ".md5";
    const currentMD5 = md5File.sync(code);
    writeToFileSync(pathMD5, currentMD5);
}

/**
 * Call preRun method to "compile" code.
 * If there is no preRun method available return Option.none
 *
 * @param code
 * @param output
 * @param path
 * @param timeout
 */
export function preRun(
    code: string,
    output: string,
    path: string,
    timeout: number
): Option<Execution> {
    debug("pre-run", code, output, path, timeout); //add more debug

    // check if md5 is same and wcmp is already compiled
    if (checkMD5(code, path) && existsSync(output)) {
        return Option.some(Execution.cached());
    }

    const codeExt = extension(code);
    const language = loadConfig(codeExt);

    if (language.preRun.length === 0) {
        // No preRun command, so nothing to run.
        debug("pre-run", "preRun empty. Nothing to run");
        return Option.none();
    }

    const command = substituteArgsWith(
        language.preRun,
        code,
        output,
        join(path, ATTIC)
    );

    const execution = runSingle(command, timeout, "");

    if (execution.failed()) {
        onCompilationError(code, execution);
    } else {
        if (execution.stderr().length > 0) {
            showCompileError(execution.stderr().toString("utf8"));
        }
        dumpMD5(code, path);
    }

    return new Option(execution);
}

export function run(
    code: string,
    output: string,
    path: string,
    input: string,
    timeout: number
): Execution {
    return runWithArgs(code, output, path, input, timeout, []);
}

export function runWithArgs(
    code: string,
    output: string,
    path: string,
    input: string,
    timeout: number,
    args: string[]
): Execution {
    debug("run", code);
    const codeExt = extension(code);
    const language = loadConfig(codeExt);

    if (language.run === undefined || language.run.length === 0) {
        // No run command, so nothing to execute.
        debug("run", "run empty.");
        throw new Error(
            `Nothing to run. Expected something to run for extension ${codeExt}`
        );
    }

    let command = substituteArgsWith(
        language.run,
        code,
        output,
        join(path, ATTIC)
    );

    command = command.concat(args);
    return runSingle(command, timeout, input);
}

export function runSingle(
    command: string[],
    timeout: number,
    input: string
): Execution {
    debug(
        "execute",
        `${command} timeout: ${timeout} input-length: ${input.length}`
    );

    const main = command[0];
    const args = command.slice(1);

    const startTime = new Date().getTime();
    const result = spawnSync(main, args, {
        input: input,
        timeout: timeout,
        killSignal: "SIGTERM",
    });
    const timeSpan = new Date().getTime() - startTime;

    return new Execution(result, timeSpan, timeout);
}
