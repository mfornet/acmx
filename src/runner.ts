import { spawnSync } from "child_process";
import {
    Execution,
    LanguageCommand,
    Option,
    LANGUAGES,
    ATTIC,
} from "./primitives";
import { globalHomePath } from "./core";
import { join, basename } from "path";
import { readdirSync, readFileSync, existsSync } from "fs";
import { extension, substituteArgsWith, debug, writeToFileSync } from "./utils";
import { onCompilationError } from "./errors";
import md5File = require("md5-file");

function loadExtensionConfig(extension: string): LanguageCommand {
    debug("load-extension-config", extension);
    let languagesPath = join(globalHomePath(), LANGUAGES);
    let candidates: string[] = [];

    let filtered = readdirSync(languagesPath).filter((file) => {
        try {
            let content = readFileSync(join(languagesPath, file), "utf8");
            let language = JSON.parse(content);

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
        debug("fail-load-extension-config");
        throw new Error(
            `Configuration not found for extension ${extension}. Candidates are: ${candidates.join(
                ","
            )}`
        );
    }

    let languagePath = join(languagesPath, filtered[0]);
    let content = readFileSync(languagePath, "utf8");
    let language = JSON.parse(content);
    return new LanguageCommand(language.run || [], language.preRun || []);
}

/**
 * Check if code was already compiled
 */
function checkMD5(code: string, path: string): boolean {
    debug("check-md5", code);
    let pathMD5 = join(path, ATTIC, basename(code)) + ".md5";
    let storedMD5 = "";
    if (existsSync(pathMD5)) {
        storedMD5 = readFileSync(pathMD5, "utf8");
    }
    let currentMD5 = md5File.sync(code);
    return currentMD5 === storedMD5;
}

/**
 * Copy MD5 from current file into a folder to avoid compiling again.
 */
function dumpMD5(code: string, path: string) {
    debug("dump-md5", code);
    let pathMD5 = join(path, ATTIC, basename(code)) + ".md5";
    let currentMD5 = md5File.sync(code);
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
    debug("pre-run", code);
    if (checkMD5(code, path)) {
        return Option.some(Execution.cached());
    }

    let codeExt = extension(code);
    let language = loadExtensionConfig(codeExt);

    if (language.preRun.length === 0) {
        // No preRun command, so nothing to run.
        debug("pre-run", "preRun empty. Nothing to run");
        return Option.none();
    }

    let command = substituteArgsWith(
        language.preRun,
        code,
        output,
        join(path, ATTIC)
    );

    let execution = runSingle(command, timeout, "");

    if (execution.failed()) {
        onCompilationError(code, path, execution);
    } else {
        dumpMD5(code, path);
    }

    debug("fin-pre-run", execution.status);
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
    debug("run-with-args", code);
    let codeExt = extension(code);
    let language = loadExtensionConfig(codeExt);

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

    let main = command[0];
    let args = command.slice(1);

    let startTime = new Date().getTime();
    let result = spawnSync(main, args, {
        input: input,
        timeout: timeout,
        killSignal: "SIGTERM",
    });
    let timeSpan = new Date().getTime() - startTime;

    debug("fin-execute", result, timeSpan);
    return new Execution(result, timeSpan, timeout);
}
