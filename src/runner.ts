import { spawnSync } from "child_process";
import { debug } from "./log";
import { Execution, LanguageCommand } from "./types";
import { pathToStatic, LANGUAGES, ATTIC } from "./core";
import { join } from "path";
import { readdirSync, readFileSync } from "fs-extra";
import { extension } from "./utils";

function loadConfig(extension: string) {
    let languagesPath = join(pathToStatic(), LANGUAGES);

    let filtered = readdirSync(languagesPath).filter((file) => {
        try {
            console.debug(file);
            let content = readFileSync(join(languagesPath, file), "utf8");
            let language = JSON.parse(content);
            console.debug(language);

            if (language.ext == extension) {
                console.debug("OK");
                return true;
            }
        } catch {
            return false;
        }
    });

    let languagePath = join(languagesPath, filtered[0]);
    let content = readFileSync(languagePath, "utf8");
    let language = JSON.parse(content);
    return new LanguageCommand(language.run, language.preRun);
}

function makeSubstitution(
    args: string[],
    code: string,
    output: string,
    attic: string
) {
    return args.map((arg) => {
        if (arg == "$CODE") {
            return code;
        } else if (arg == "$OUTPUT") {
            return output;
        } else if (arg == "$ATTIC") {
            return attic;
        } else {
            return arg;
        }
    });
}

export function preRun(
    code: string,
    output: string,
    path: string,
    timeout: number,
    compilation_error_callback: (
        code: string,
        path: string,
        execution: Execution
    ) => void
) {
    debug("pre-run", code);
    let codeExt = extension(code);
    let language = loadConfig(codeExt);
    if (language.preRun === undefined || language.preRun.length === 0) {
        return;
    }
    let command = makeSubstitution(
        language.preRun,
        code,
        output,
        join(path, ATTIC)
    );

    let execution = runSingle(command, timeout, "");

    // TODO(now): remove this callback and simply handle this outside of preRun with Error type
    if (execution.failed()) {
        compilation_error_callback(code, path, execution);
    }

    return execution;
}

// TODO(now): Add md5 support | md5 files should live inside ATTIC
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
) {
    return runWithArgs(code, output, path, input, timeout, []);
}

export function runWithArgs(
    code: string,
    output: string,
    path: string,
    input: string,
    timeout: number,
    args: string[]
) {
    debug("pre-run", code);
    let codeExt = extension(code);
    let language = loadConfig(codeExt);
    if (language.preRun === undefined || language.preRun.length === 0) {
        return;
    }
    let command = makeSubstitution(
        language.run,
        code,
        output,
        join(path, ATTIC)
    );

    command = command.concat(args);
    return runSingle(command, timeout, input);
}

export function runSingle(command: string[], timeout: number, input: string) {
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
