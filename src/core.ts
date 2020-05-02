"use strict";
import * as child_process from "child_process";
import {
    closeSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    openSync,
    readdirSync,
    readFileSync,
    writeSync,
} from "fs";
import { basename, dirname, extname, join } from "path";
import * as vscode from "vscode";
import * as gwen from "./gwen";
import {
    Contest,
    Problem,
    SiteDescription,
    SolutionResult,
    TestCaseResult,
    Verdict,
} from "./types";
import md5File = require("md5-file");

export const TESTCASES = "testcases";
export const ATTIC = "attic";

/**
 * Path to static folder.
 */
export function pathToStatic() {
    return join(dirname(dirname(__filename)), "static");
}

/**
 * Name of program file. Take extension dynamically from configuration.
 */
export function solFile() {
    let extension: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("extension");
    return "sol." + extension;
}

export function getTimeout() {
    let timeout: number | undefined = vscode.workspace
        .getConfiguration("acmx.run", null)
        .get("timeLimit");
    timeout = timeout! * 1000;
    return timeout;
}

function isProblemFolder(path: string) {
    return existsSync(join(path, solFile())) && existsSync(join(path, "attic"));
}

function isTestCase(path: string) {
    let ext = extname(path);
    return ext === ".in" || ext === ".ans" || ext === ".out";
}

export function currentTestCase() {
    let answer: string | undefined = undefined;

    // Try to find an open test case
    if (vscode.window.activeTextEditor) {
        let path = vscode.window.activeTextEditor.document.uri.fsPath;

        if (isTestCase(path)) {
            answer = removeExtension(basename(path));
        }
    }

    // Try to find the test case watching the current open workspace folder
    if (vscode.workspace.workspaceFolders !== undefined) {
        vscode.workspace.workspaceFolders.forEach(function (fd) {
            if (answer === undefined && isTestCase(fd.uri.fsPath)) {
                answer = removeExtension(basename(fd.uri.fsPath));
            }
        });
    }

    // Test case not found
    return answer;
}
export function currentProblem() {
    // Try to find the problem using current open file
    if (vscode.window.activeTextEditor) {
        let path = vscode.window.activeTextEditor.document.uri.fsPath;

        const MAX_DEPTH = 3;

        for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
            path = dirname(path);
        }

        if (isProblemFolder(path)) {
            return path;
        }
    }

    // Try to find the problem using the current open workspace folder
    if (vscode.workspace.workspaceFolders !== undefined) {
        let path = vscode.workspace.workspaceFolders[0].uri.fsPath;

        const MAX_DEPTH = 1;

        for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
            path = dirname(path);
        }

        if (isProblemFolder(path)) {
            return path;
        }
    }

    // Problem not found
    return undefined;
}

function createFolder(path: string) {
    if (!existsSync(path)) {
        createFolder(dirname(path));
        mkdirSync(path);
    }
}

/**
 * Path to common attic for every problem.
 *
 * @param testingPath Use for unit tests
 */
export function globalAtticPath(testPath: string | undefined = undefined) {
    if (testPath !== undefined) {
        return join(testPath, ATTIC);
    }

    let path: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("solutionPath");
    return join(path!, ATTIC);
}

/**
 * Create default environment that let acmX run properly
 */
export function initAcmX(testPath: string | undefined = undefined) {
    // Create global attic.
    let globalAttic = globalAtticPath(testPath);
    createFolder(globalAttic);

    // Create checker folder
    let checkerFolder = join(globalAttic, "checkers");
    createFolder(checkerFolder);

    // Copy testlib
    let testlib = "testlib.h";
    if (!existsSync(join(checkerFolder, testlib))) {
        copyFileSync(
            join(pathToStatic(), "checkers", testlib),
            join(checkerFolder, testlib)
        );
    }

    // Create wcmp checker
    let checkerName = "wcmp.cpp";
    if (!existsSync(join(checkerFolder, checkerName))) {
        copyFileSync(
            join(pathToStatic(), "checkers", checkerName),
            join(checkerFolder, checkerName)
        );
    }

    // Compile checker
    let compiledName = "wcmp.exe";
    if (!existsSync(join(checkerFolder, compiledName))) {
        let checkerPath = join(checkerFolder, checkerName);
        let compiledPath = join(checkerFolder, compiledName);
        child_process.spawnSync("g++", [
            "-std=c++11",
            `${checkerPath}`,
            "-o",
            `${compiledPath}`,
        ]);
    }

    if (!existsSync(join(checkerFolder, compiledName))) {
        vscode.window.showErrorMessage("Compilation failed.");
        return;
    }
}

export function newArena(path: string) {
    createFolder(path);

    let testcases = join(path, TESTCASES);
    createFolder(testcases);

    let attic = join(path, ATTIC);
    createFolder(attic);

    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("templatePath");

    if (templatePath! === "") {
        templatePath = join(pathToStatic(), "template.cpp");
    }

    let solution = join(path, solFile());

    if (!existsSync(solution)) {
        copyFileSync(templatePath!, join(path, solFile()));
    }
}

export function removeExtension(name: string) {
    let split = name.split(".");
    if (split.length === 0) {
        return name;
    } else {
        split.pop(); // drop extension
        return split.join(".");
    }
}

export function testCasesName(path: string) {
    return readdirSync(join(path, TESTCASES))
        .filter(function (tc_path) {
            return extname(tc_path) === ".in";
        })
        .map(function (tc_path) {
            return removeExtension(tc_path);
        });
}

export function upgradeArena(path: string) {
    // Create brute force solution
    let brute = join(path, "brute.cpp");

    if (!existsSync(brute)) {
        // Create brute.cpp file
        copyFileSync(join(pathToStatic(), "template.cpp"), brute);
    }

    // Create test case generator
    let generator = join(path, "gen.py");

    if (!existsSync(generator)) {
        // TODO(#21): If generator already exist don't overwrite but log that it was not created.
        gwen.create(path, generator);
    }

    // Create checker for multiple answers.
    let checker = join(path, ATTIC, "checker.cpp");

    if (!existsSync(checker)) {
        let testlib_path = join(path, ATTIC, "testlib.h");
        copyFileSync(join(pathToStatic(), "checkers", "wcmp.cpp"), checker);
        copyFileSync(
            join(pathToStatic(), "checkers", "testlib.h"),
            testlib_path
        );
    }
}

function copyDefaultFilesToWorkspace(path: string) {
    let vscodeFolder = join(path, ".vscode");
    createFolder(vscodeFolder);

    // acmx.configuration.tasks
    let tasksPath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("tasks");
    let launchPath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("launch");

    if (tasksPath !== "") {
        if (tasksPath === undefined || !existsSync(tasksPath)) {
            vscode.window.showErrorMessage(`tasks file ${tasksPath} not found`);
        } else {
            copyFileSync(tasksPath, join(vscodeFolder, "tasks.json"));
        }
    }

    if (launchPath !== "") {
        if (launchPath === undefined || !existsSync(launchPath)) {
            vscode.window.showErrorMessage(
                `launch file ${launchPath} not found`
            );
        } else {
            copyFileSync(launchPath, join(vscodeFolder, "launch.json"));
        }
    }
}

function newProblem(path: string, problem: Problem, isWorkspace: boolean) {
    newArena(path);

    if (isWorkspace) {
        copyDefaultFilesToWorkspace(path);
    }

    problem.inputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.in`), "w");
        writeSync(fd, value);
    });

    problem.outputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.ans`), "w");
        writeSync(fd, value);
    });
}

export function newProblemFromId(
    path: string,
    site: SiteDescription,
    problemId: string
) {
    let problem = site.problemParser(problemId);

    path = join(path, problem.identifier!);

    newProblem(path, problem, true);

    return path;
}

function newContest(path: string, contest: Contest) {
    contest.problems!.forEach((problem) => {
        newProblem(join(path, problem.identifier!), problem, false);
    });
}

export function newProblemFromCompanion(config: any) {
    let _path: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("solutionPath");
    let path = _path!;

    let contestPath = join(path, config.group);
    createFolder(contestPath);

    let problemPath = join(contestPath, config.name);
    let inputs: string[] = [];
    let outputs: string[] = [];

    config.tests.forEach(function (test_case: any) {
        inputs.push(test_case.input);
        outputs.push(test_case.output);
    });

    copyDefaultFilesToWorkspace(contestPath);
    newProblem(
        problemPath,
        new Problem(config.name, config.name, inputs, outputs),
        false
    );

    return contestPath;
}

/**
 * Create a contest
 *
 * @param contestId Id of the contest that user want to retrieve.
 */
export async function newContestFromId(
    path: string,
    site: SiteDescription,
    contestId: string
) {
    let contest = await site.contestParser(contestId);
    let contestPath = join(path, site.name, contest.name);

    createFolder(contestPath);
    copyDefaultFilesToWorkspace(contestPath);
    newContest(contestPath, contest);

    return contestPath;
}

function get_checker_path() {
    let path = currentProblem();
    let default_checker = join(globalAtticPath(), "checkers", "wcmp.exe");

    if (path === undefined) {
        return default_checker;
    }

    let potential_checker_path = join(path, ATTIC, "checker.cpp");

    if (existsSync(potential_checker_path)) {
        let checker_output = join(path, ATTIC, "checker.exe");
        compileCode(potential_checker_path, checker_output);
        return checker_output;
    }

    return default_checker;
}

/**
 *
 * @param path
 * @param tcName
 * @param timeout in milliseconds
 */
export function timedRun(path: string, tcName: string, timeout: number) {
    let tcInput = join(path, TESTCASES, `${tcName}.in`);
    let tcOutput = join(path, TESTCASES, `${tcName}.ans`);
    let tcCurrent = join(path, TESTCASES, `${tcName}.out`);

    let tcData = readFileSync(tcInput, "utf8");

    let startTime = new Date().getTime();
    let command = `${join(path, ATTIC, "sol.exe")}`;

    let result = child_process.spawnSync(command, {
        input: tcData,
        timeout,
        killSignal: "SIGTERM",
    });

    let spanTime = new Date().getTime() - startTime;

    // Check if an error happened
    if (result.status !== 0) {
        if (spanTime < timeout) {
            return new TestCaseResult(Verdict.RTE);
        } else {
            return new TestCaseResult(Verdict.TLE);
        }
    }

    // Check output is ok
    let currentFd = openSync(tcCurrent, "w");
    writeSync(currentFd, result.stdout);
    closeSync(currentFd);

    let checker_path = get_checker_path();
    let checker_result = child_process.spawnSync(checker_path, [
        tcInput,
        tcCurrent,
        tcOutput,
    ]);

    if (checker_result.status !== 0) {
        return new TestCaseResult(Verdict.WA);
    } else {
        return new TestCaseResult(Verdict.OK, spanTime);
    }
}

export function showCompileError(path: string, compile_error: string) {
    let error_path = join(path, ATTIC, "stderr");
    let error_file = openSync(error_path, "w");
    writeSync(error_file, compile_error);
    vscode.commands.executeCommand("vscode.setEditorLayout", {
        orientation: 1,
        groups: [
            { groups: [{}], size: 0.5 },
            { groups: [{}], size: 0.5 },
        ],
    });
    vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(error_path),
        vscode.ViewColumn.Two
    );
}

export function compileCode(pathCode: string, pathOutput: string) {
    let pathCodeMD5 = pathCode + ".md5";
    let md5data = "";

    if (existsSync(pathCodeMD5)) {
        md5data = readFileSync(pathCodeMD5, "utf8");
    }

    let codeMD5 = md5File.sync(pathCode);

    if (codeMD5 === md5data) {
        return {
            status: 0,
            stderr: "",
        };
    }

    let codeMD5fd = openSync(pathCodeMD5, "w");
    writeSync(codeMD5fd, codeMD5 + "\n");
    closeSync(codeMD5fd);

    let instruction: string | undefined = vscode.workspace
        .getConfiguration("acmx.execution", null)
        .get("compile");
    if (instruction === undefined || instruction === "") {
        instruction = "g++ -std=c++17 $PROGRAM -o $OUTPUT";
    }
    let splitInstruction = instruction.split(" ");

    for (let i = 0; i < splitInstruction.length; ++i) {
        splitInstruction[i] = splitInstruction[i]
            .replace("$PROGRAM", pathCode)
            .replace("$OUTPUT", pathOutput);
    }

    let program = splitInstruction[0];
    let args = splitInstruction.slice(1);

    let result = child_process.spawnSync(program, args);
    return result;
}

export function testSolution(path: string) {
    let sol = join(path, solFile());
    let out = join(path, ATTIC, "sol.exe");

    if (!existsSync(sol)) {
        vscode.window.showErrorMessage("Open a coding environment first");
        throw new Error("");
    }

    // Compile solution
    let result = compileCode(sol, out);

    if (result.status !== 0) {
        vscode.window.showErrorMessage(`Compilation Error. ${sol}`);
        showCompileError(path, result.stderr.toString());
        throw new Error("");
    }

    let testcasesId = testCasesName(path);

    if (testcasesId.length === 0) {
        return new SolutionResult(Verdict.NO_TESTCASES, undefined, undefined);
    }

    // Process all testcases in sorted order
    testcasesId.sort();

    // Run current test case first (if it exists)
    let startTc = currentTestCase();

    if (startTc !== undefined) {
        testcasesId = testcasesId.reverse().filter((name) => name !== startTc);
        testcasesId.push(startTc);
        testcasesId = testcasesId.reverse();
    }

    let results: TestCaseResult[] = [];
    let fail: SolutionResult | undefined = undefined;
    testcasesId.forEach((tcId) => {
        // Run while there none have failed already
        if (fail === undefined) {
            let tcResult = timedRun(path, tcId, getTimeout());
            if (tcResult.status !== Verdict.OK) {
                fail = new SolutionResult(tcResult.status, tcId);
            }
            results.push(tcResult);
        }
    });

    if (fail === undefined) {
        let maxTime = 0;
        for (let i = 0; i < results.length; i++) {
            if (results[i].spanTime! > maxTime) {
                maxTime = results[i].spanTime!;
            }
        }

        return new SolutionResult(Verdict.OK, undefined, maxTime);
    } else {
        return fail;
    }
}

function generateTestCase(path: string) {
    let python: string | undefined = vscode.workspace
        .getConfiguration("acmx.execution", null)
        .get("pythonPath");
    let genResult = child_process.spawnSync(python!, [join(path, "gen.py")]);

    let currentFd = openSync(join(path, TESTCASES, "gen.in"), "w");
    writeSync(currentFd, genResult.stdout);
    closeSync(currentFd);
}

export function stressSolution(path: string, times: number) {
    let sol = join(path, solFile());
    let out = join(path, ATTIC, "sol");
    let brute = join(path, "brute.cpp");

    if (!existsSync(sol)) {
        vscode.window.showErrorMessage("Open a coding environment first.");
        throw new Error("");
    }

    if (!existsSync(brute)) {
        vscode.window.showErrorMessage("Upgrade environment first.");
        throw new Error("");
    }

    let brute_out = join(path, ATTIC, "brute.exe");

    let solCompileResult = compileCode(sol, out);
    if (solCompileResult.status !== 0) {
        vscode.window.showErrorMessage(`Compilation Error. ${sol}`);
        showCompileError(path, solCompileResult.stderr.toString());
        throw new Error("");
    }

    let bruteCompileResult = compileCode(brute, brute_out);
    if (bruteCompileResult.status !== 0) {
        vscode.window.showErrorMessage(`Compilation Error. ${brute}`);
        showCompileError(brute, bruteCompileResult.stderr.toString());
        throw new Error("");
    }

    let results = [];

    for (let index = 0; index < times; index++) {
        // Generate input test case
        generateTestCase(path);

        // Generate output test case from brute.cpp
        let tcData = readFileSync(join(path, TESTCASES, "gen.in"), "utf8");

        // Run without restrictions
        // TODO(#25): Put time limit on all type of programs
        let runResult = child_process.spawnSync(brute_out, {
            input: tcData,
        });

        // Finally write .out
        let currentFd = openSync(join(path, TESTCASES, "gen.ans"), "w");
        writeSync(currentFd, runResult.stdout);
        closeSync(currentFd);

        // Check sol report same result than brute
        let result = timedRun(path, "gen", getTimeout());

        if (result.status !== Verdict.OK) {
            return new SolutionResult(result.status, "gen");
        }

        results.push(result);
    }

    let maxTime = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i].spanTime! > maxTime) {
            maxTime = results[i].spanTime!;
        }
    }

    return new SolutionResult(Verdict.OK, undefined, maxTime);
}

export function verdictName(verdict: Verdict) {
    switch (verdict) {
        case Verdict.OK:
            return "OK";

        case Verdict.WA:
            return "WA";

        case Verdict.TLE:
            return "TLE";

        case Verdict.RTE:
            return "RTE";

        case Verdict.CE:
            return "CE";

        default:
            throw new Error("Invalid Verdict");
    }
}
