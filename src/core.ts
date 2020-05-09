"use strict";
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
import {
    Contest,
    Problem,
    SiteDescription,
    SolutionResult,
    TestCaseResult,
    Verdict,
    Option,
    CompileResult,
} from "./types";
import { writeToFileSync, substituteArgWith } from "./utils";
import { debug } from "./log";
import { preRun, run, runWithArgs } from "./runner";

export const TESTCASES = "testcases";
export const ATTIC = "attic";
export const LANGUAGES = "languages";
export const FRIEND_TIMEOUT = 10_000;

// TODO(now): More debugging.
// TODO(now): Allow turn on/off debugging.
// TODO(now): Better error handling.
//              Never return undefined from any function (Return Error instead and handle it)
// TODO(now): Refactor library

/**
 * Path to static folder.
 */
export function pathToStatic() {
    return join(dirname(dirname(__filename)), "static");
}

/**
 * Load configuration from given problem.
 *
 * @param path Problem path
 */
function loadConfig(path: string) {
    let config = readFileSync(join(path, ATTIC, "config.json"), "utf8");
    return JSON.parse(config);
}

/**
 * Path to main solution for given problem.
 *
 * @param path Problem path
 */
export function mainSolution(path: string): string {
    // TODO(Now): This is not backward compatible.
    let mainSolution = loadConfig(path).mainSolution;
    debug("mainSolution", `${mainSolution}`);
    return mainSolution;
}

/**
 * Return global timeout from configuration.
 */
export function getTimeout(): number {
    let timeout: number | undefined = vscode.workspace
        .getConfiguration("acmx.run", null)
        .get("timeLimit");
    timeout = timeout! * 1000;
    return timeout;
}

function isProblemFolder(path: string) {
    return existsSync(join(path, "attic"));
}

function isTestCase(path: string) {
    let ext = extname(path);
    return ext === ".in" || ext === ".out" || ext === ".real";
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
export function globalHomePath(testPath: string | undefined = undefined) {
    if (testPath !== undefined) {
        return testPath;
    }

    let path: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("homePath");

    if (path !== undefined) {
        path = substituteArgWith(path);
    }

    return path;
}

/**
 * Initialize acmx environment.
 */
export function initAcmX(testPath: string | undefined = undefined) {
    // Create global attic.
    let globalHome = globalHomePath(testPath)!;
    createFolder(globalHome);

    // Create checker folder
    let checkerFolder = join(globalHome, "checkers");
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
    let compiledName = "wcmp";
    if (!existsSync(join(checkerFolder, compiledName))) {
        let checkerPath = join(checkerFolder, checkerName);
        let compiledPath = join(checkerFolder, compiledName);

        preRun(checkerPath, compiledPath, checkerFolder, FRIEND_TIMEOUT);
    }

    // Copy default languages config
    let languagesFolder = join(globalHome, LANGUAGES);
    let languageStaticFolder = join(pathToStatic(), LANGUAGES);
    if (!existsSync(languagesFolder)) {
        createFolder(languagesFolder);
    }

    readdirSync(languageStaticFolder).forEach((file) => {
        let target = join(languagesFolder, file);
        if (!existsSync(target)) {
            debug("language", `Copied new language configuration: ${file}`);
            copyFileSync(join(languageStaticFolder, file), target);
        } else {
            debug("language", `Existing language configuration: ${file}`);
        }
    });
}

function copyConfigFromTemplate(
    path: string,
    template: string,
    override: boolean
): string {
    // TODO(Now): Handle when template path are folders
    //              Parse input file after @ and copy entire folder to target.

    let fileName = basename(template);
    let target = join(path, fileName);

    if (override || !existsSync(target)) {
        copyFileSync(template, target);
    }

    return target;
}

export function newArena(path: string, config: any) {
    debug("newArena", `path: ${path} config: ${config}`);
    createFolder(path);

    let testcases = join(path, TESTCASES);
    createFolder(testcases);

    let attic = join(path, ATTIC);
    createFolder(attic);

    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("templatePath");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "sol.cpp");
    } else {
        templatePath = substituteArgWith(templatePath);
    }

    debug("newArena", `Using template path: ${templatePath}`);

    config.mainSolution = copyConfigFromTemplate(path, templatePath, true);
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

function bruteSolutionPath(path: string): string {
    let bruteSolution = loadConfig(path).bruteSolution;
    return bruteSolution;
}

function addBruteSolution(path: string) {
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("bruteTemplate");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "brute.cpp");
    }

    let config = loadConfig(path);
    config.bruteSolution = copyConfigFromTemplate(path, templatePath, false);
    dumpConfig(path, config);
}

function generatorPath(path: string): string {
    let generator = loadConfig(path).generator;
    return generator;
}

function addGenerator(path: string) {
    // TODO(#51): Use tcgen
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("generatorTemplate");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "gen.py");
    }

    let config = loadConfig(path);
    config.bruteSolution = copyConfigFromTemplate(path, templatePath, false);
    dumpConfig(path, config);
}

function checkerPath(path: string): string {
    let checker = loadConfig(path).checker;
    return checker;
}

function addChecker(path: string) {
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("checkerTemplate");

    if (templatePath === undefined || templatePath === "") {
        // TODO(now): Use folder with testlib.h
        // += @checker.cpp
        templatePath = join(pathToStatic(), "templates", "checker.cpp");
    }

    let config = loadConfig(path);
    config.checkerSolution = copyConfigFromTemplate(path, templatePath, false);
    dumpConfig(path, config);
}

export function upgradeArena(path: string) {
    // Load brute force solution
    let bruteCode = bruteSolutionPath(path);
    if (bruteCode === undefined || !existsSync(bruteCode)) {
        addBruteSolution(path);
    }

    // Load generator
    let generatorCode = generatorPath(path);
    if (generatorCode === undefined || !existsSync(generatorCode)) {
        addGenerator(path);
    }

    // Load checker
    let checkerCode = checkerPath(path);
    if (checkerCode === undefined || !existsSync(checkerCode)) {
        addChecker(path);
    }
}

function copyDefaultFilesToWorkspace(path: string) {
    let vscodeFolder = join(path, ".vscode");
    createFolder(vscodeFolder);

    let tasksPath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("tasks");

    if (tasksPath !== "") {
        if (tasksPath === undefined || !existsSync(tasksPath)) {
            vscode.window.showErrorMessage(`tasks file ${tasksPath} not found`);
        } else {
            copyFileSync(tasksPath, join(vscodeFolder, "tasks.json"));
        }
    }

    let launchPath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("launch");

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

// TODO(now) Make configuration file typed
function dumpConfig(path: string, config: any) {
    let configFile = JSON.stringify(config, null, 2);
    writeToFileSync(join(path, ATTIC, "config.json"), configFile);
}

function newProblem(
    path: string,
    problem: Problem,
    config: any,
    isWorkspace: boolean
) {
    newArena(path, config);

    if (isWorkspace) {
        copyDefaultFilesToWorkspace(path);
    }

    dumpConfig(path, config);

    problem.inputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.in`), "w");
        writeSync(fd, value);
        closeSync(fd);
    });

    problem.outputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.out`), "w");
        writeSync(fd, value);
        closeSync(fd);
    });
}

export function newProblemFromId(
    path: string,
    site: SiteDescription,
    problemId: string
) {
    let problem = site.problemParser(problemId);

    path = join(path, problem.identifier!);

    newProblem(path, problem, {}, true);

    return path;
}

function newContest(path: string, contest: Contest) {
    contest.problems!.forEach((problem) => {
        newProblem(join(path, problem.identifier!), problem, {}, false);
    });
}

export function getSolutionPath() {
    let path: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("solutionPath");

    if (path !== undefined) {
        path = substituteArgWith(path);
    }

    return path;
}

export function newProblemFromCompanion(config: any) {
    let path = getSolutionPath();

    let contestPath = join(path!, config.group);
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
        config,
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
    let contest = site.contestParser(contestId);
    let contestPath = join(path, site.name, contest.name);

    createFolder(contestPath);
    copyDefaultFilesToWorkspace(contestPath);
    newContest(contestPath, contest);

    return contestPath;
}

/**
 * Find checker path for current problem. First look in the config file
 * Otherwise use wcmp (checker that compare by token).
 *
 * If local checker is found try to compile it.
 */
function getCheckerPath() {
    let globalHome = globalHomePath();
    let checkerCode = join(globalHome!, "checkers", "wcmp.cpp");
    let checkerOutput = join(globalHome!, "checkers", "wcmp");

    let path = currentProblem();

    if (path === undefined) {
        return [checkerCode, checkerOutput];
    }

    let potentialCheckerCode = checkerPath(path);

    if (existsSync(potentialCheckerCode)) {
        let potentialCheckerOutput = join(path, ATTIC, "checker");
        preRun(
            potentialCheckerCode,
            potentialCheckerOutput,
            path,
            FRIEND_TIMEOUT
        );
        return [potentialCheckerCode, potentialCheckerOutput];
    } else {
        return [checkerCode, checkerOutput];
    }
}

export function timedRun(
    path: string,
    tcName: string,
    timeout: number,
    sol: string,
    output: string
) {
    let tcInput = join(path, TESTCASES, `${tcName}.in`);
    let tcOutput = join(path, TESTCASES, `${tcName}.out`);
    let tcCurrent = join(path, TESTCASES, `${tcName}.real`);

    let tcData = readFileSync(tcInput, "utf8");

    let execution = run(sol, output, path, tcData, timeout);
    // TODO(now): Handle all undefined with Error types
    if (execution === undefined) {
        return;
    }

    let result = execution.result;
    let timeSpan = execution.timeSpan;

    // Check if an error happened
    if (execution.failed()) {
        if (execution.isTLE()) {
            return new TestCaseResult(Verdict.TLE);
        } else {
            return new TestCaseResult(Verdict.RTE);
        }
    }

    // Check output is ok
    let currentFd = openSync(tcCurrent, "w");
    writeSync(currentFd, result.stdout);
    closeSync(currentFd);

    let [checkerCode, checkerOutput] = getCheckerPath();

    let checker_execution = runWithArgs(
        checkerCode,
        checkerOutput,
        join(path, ATTIC),
        "",
        FRIEND_TIMEOUT,
        [tcInput, tcCurrent, tcOutput]
    );

    if (checker_execution === undefined) {
        return;
    }

    // TODO(Now): Handle the case when the checker gives timeout
    let checker_result = checker_execution.result;

    if (checker_result.status !== 0) {
        return new TestCaseResult(Verdict.WA);
    } else {
        return new TestCaseResult(Verdict.OK, timeSpan);
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

export function testSolution(path: string) {
    let sol = mainSolution(path);
    let out = join(path, ATTIC, "sol");

    if (!existsSync(sol)) {
        vscode.window.showErrorMessage("Open a coding environment first");
        return;
    }

    // Compile solution
    let execution = preRun(sol, out, path, FRIEND_TIMEOUT);

    if (
        execution.mapOr(false, (exec) => {
            return exec.failed();
        })
    ) {
        // Return early if compilation failed.
        return;
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
            let tcResult = timedRun(path, tcId, getTimeout(), sol, out);

            // TODO(now): Handle this with better error.
            if (tcResult === undefined) {
                return;
            }

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

function getCompileResult(
    code: string,
    output: string,
    path: string
): Option<CompileResult> {
    let execution = preRun(code, output, path, FRIEND_TIMEOUT);

    if (execution.isNone()) {
        // If there is no code to compile. Return current code as expected output.
        return Option.some(new CompileResult(code));
    }

    if (execution.unwrap().failed()) {
        return Option.none();
    }

    return Option.some(new CompileResult(code, output));
}

/**
 * Find generator from config. Compile it if necessary.
 * Return Option.none if failed.
 *
 * @param path
 */
function getGeneratorPath(path: string): Option<CompileResult> {
    // TODO(now): Find generator from config
    let generatorCode = join(path, "gen.py");
    let generatorOutput = join(path, ATTIC, "gen");

    if (!existsSync(generatorCode)) {
        vscode.window.showErrorMessage(
            "No generator found. Upgrade environment first."
        );
        return Option.none();
    }

    return getCompileResult(generatorCode, generatorOutput, path);
}

/**
 * Find brute from config. Compile it if necessary.
 * Return Option.none if failed.
 *
 * @param path
 */
function getBrutePath(path: string): Option<CompileResult> {
    let bruteCode = join(path, "brute.cpp");
    let bruteOutput = join(path, ATTIC, "brute");

    if (!existsSync(bruteCode)) {
        vscode.window.showErrorMessage(
            "No brute solution found. Upgrade environment first."
        );
        return Option.none();
    }

    return getCompileResult(bruteCode, bruteOutput, path);
}

// TODO(now) Same function as above for checker.

function generateTestCase(path: string, code: string, output: string) {
    // TODO(now): Handle executions errors
    let genExecution = run(code, output, path, "", FRIEND_TIMEOUT);
    let genResult = genExecution!.result;

    // TODO(now): Test the to string here
    writeToFileSync(
        join(path, TESTCASES, "gen.in"),
        genResult.stdout.toString()
    );
}

export function stressSolution(path: string, times: number) {
    let sol = mainSolution(path);
    let out = join(path, ATTIC, "sol");

    if (!existsSync(sol)) {
        vscode.window.showErrorMessage("Open a coding environment first.");
        return;
    }

    // Compile main solution
    let execution = preRun(sol, out, path, FRIEND_TIMEOUT);

    if (
        execution.mapOr(false, (exec) => {
            return exec.failed();
        })
    ) {
        // Return early if failed compiling main solution;
        return;
    }

    // Get brute file
    let bruteResultOpt = getBrutePath(path);

    if (bruteResultOpt.isNone()) {
        // Return early if couldn't find or compile brute solution.
        return;
    }

    let bruteResult = bruteResultOpt.unwrap();

    // Get generator file
    let generatorResultOpt = getGeneratorPath(path);

    if (generatorResultOpt.isNone()) {
        // Return early if couldn't find or compile generator.
        return;
    }

    let generatorResult = generatorResultOpt.unwrap();

    let results = [];

    for (let index = 0; index < times; index++) {
        // Generate input test case
        generateTestCase(
            path,
            generatorResult.code,
            generatorResult.getOutput()
        );

        // Generate output test case from brute.cpp
        let tcData = readFileSync(join(path, TESTCASES, "gen.in"), "utf8");

        let bruteExecution = run(
            bruteResult.code,
            bruteResult.getOutput(),
            path,
            tcData,
            FRIEND_TIMEOUT
        );

        // TODO(Now): Handle the case when the brute gives timeout or runtime error
        // TODO(now): Check that this to string is working
        // Finally write .out
        writeToFileSync(
            join(path, TESTCASES, "gen.out"),
            bruteExecution!.result.stdout.toString()
        );

        // Check sol report same result than brute
        let result = timedRun(path, "gen", getTimeout(), sol, out);

        if (result!.status !== Verdict.OK) {
            return new SolutionResult(result!.status, "gen");
        }

        results.push(result);
    }

    let maxTime = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i]!.spanTime! > maxTime) {
            maxTime = results[i]!.spanTime!;
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
