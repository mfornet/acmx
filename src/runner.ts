import { spawnSync } from "child_process";
import {
    Execution,
    LanguageCommand,
    Option,
    LANGUAGES,
    ATTIC,
} from "./primitives";
import { globalHomePath } from "./core";
import { join } from "path";
import { readdirSync, readFileSync } from "fs";
import { extension, substituteArgsWith, debug } from "./utils";
import { onCompilationError } from "./errors";

function loadConfig(extension: string): LanguageCommand {
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
        throw `Configuration not found for extension ${extension}. Candidates are: ${candidates.join(
            ","
        )}`;
    }

    let languagePath = join(languagesPath, filtered[0]);
    let content = readFileSync(languagePath, "utf8");
    let language = JSON.parse(content);
    return new LanguageCommand(language.run, language.preRun);
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
    let codeExt = extension(code);
    let language = loadConfig(codeExt);

    // TODO(now): Use Option in preRun
    if (language.preRun === undefined || language.preRun.length === 0) {
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
    }

    return new Option(execution);
}

// TODO(now): Add md5 support
// export function compileCode(pathCode: string, pathOutput: string) {
//     let pathCodeMD5 = pathCode + ".md5";
//     let md5data = "";

//     if (existsSync(pathCodeMD5)) {
//         md5data = readFileSync(pathCodeMD5, "utf8");
//     }

//     let codeMD5 = md5File.sync(pathCode);

//     if (codeMD5 === md5data) {
//         return {
//             status: 0,
//             stderr: "",
//         };
//     }

//     let codeMD5fd = openSync(pathCodeMD5, "w");
//     writeSync(codeMD5fd, codeMD5 + "\n");
//     closeSync(codeMD5fd);

//     let instruction: string | undefined = vscode.workspace
//         .getConfiguration("acmx.execution", null)
//         .get("compile");
//     if (instruction === undefined || instruction === "") {
//         instruction = "g++ -std=c++17 $PROGRAM -o $OUTPUT";
//     }
//     let splitInstruction = instruction.split(" ");

//     for (let i = 0; i < splitInstruction.length; ++i) {
//         splitInstruction[i] = splitInstruction[i]
//             .replace("$PROGRAM", pathCode)
//             .replace("$OUTPUT", pathOutput);
//     }

//     let program = splitInstruction[0];
//     let args = splitInstruction.slice(1);

//     let result = child_process.spawnSync(program, args);
//     return result;
// }

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
    let codeExt = extension(code);
    let language = loadConfig(codeExt);

    if (language.run === undefined || language.run.length === 0) {
        // No run command, so nothing to execute.
        debug("run", "run empty.");
        throw `Nothing to run. Expected something to run for extension ${codeExt}`;
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

    return new Execution(result, timeSpan, timeout);
}
