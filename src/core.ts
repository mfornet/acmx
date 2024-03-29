"use strict";
import {
    closeSync,
    copyFileSync,
    existsSync,
    openSync,
    readdirSync,
    readFileSync,
    writeSync,
    renameSync,
} from "fs";
import { basename, dirname, extname, join, isAbsolute } from "path";
import * as vscode from "vscode";
import os = require("os");
import {
    Contest,
    Problem,
    SiteDescription,
    SolutionResult,
    TestCaseResult,
    Verdict,
    Option,
    CompileResult,
    ATTIC,
    FRIEND_TIMEOUT,
    LANGUAGES,
    TESTCASES,
    ConfigFile,
    CHECKER_BINARY,
    GENERATED_TEST_CASE,
    ProblemInContest,
    verdictName,
} from "./primitives";
import {
    substituteArgWith,
    debug,
    removeExtension,
    createFolder,
    writeBufferToFileSync,
} from "./utils";
import { preRun, run, runWithArgs } from "./runner";
import { copySync } from "fs-extra";
import { CompanionConfig, TestCase } from "./companion";
import { sleep } from "./utils";
import { checkLaunchWebview } from "./webview/editorChange";

/**
 * Path to static folder.
 */
export function pathToStatic() {
    return join(dirname(__dirname), "static");
}

/**
 * Path to main solution for given problem.
 * If main solution doesn't exist, it is created.
 *
 * @param path Problem path
 */
export function mainSolution(path: string): string {
    const config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    if (config.mainSolution.isNone()) {
        config.mainSolution = Option.some(populateMainSolution(path, false));
    }
    const mainSolution = config.mainSolution.unwrap();
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

export function isProblemFolder(path: string) {
    return existsSync(join(path, "attic"));
}

function isTestCase(path: string) {
    const ext = extname(path);
    return ext === ".in" || ext === ".ans" || ext === ".out";
}

export function currentTestCase(): Option<string> {
    let answer: string | undefined = undefined;

    // Try to find an open test case
    if (vscode.window.activeTextEditor) {
        const path = vscode.window.activeTextEditor.document.uri.fsPath;

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
    return new Option(answer);
}

export function currentProblem(): Option<string> {
    // Try to find the problem using current open file
    if (vscode.window.activeTextEditor) {
        let path = vscode.window.activeTextEditor.document.uri.fsPath;

        const MAX_DEPTH = 3;

        for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
            path = dirname(path);
        }

        if (isProblemFolder(path)) {
            return Option.some(path);
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
            return Option.some(path);
        }
    }

    // Problem not found
    return Option.none();
}

/**
 * Path to common attic for every problem.
 *
 * @param testingPath Use for unit tests
 */
export function globalHomePath(testPath?: string): string {
    if (testPath !== undefined) {
        return testPath;
    }

    const path_: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("homePath");

    let path = path_!;

    if (path !== undefined) {
        path = substituteArgWith(path);
    }

    path = substituteArgWith(path);

    return path;
}

export function globalLanguagePath() {
    return join(globalHomePath(), LANGUAGES);
}

/**
 * Initialize acmx environment.
 */
export function initAcmX(testPath?: string) {
    // Create global attic.
    const globalHome = globalHomePath(testPath)!;
    createFolder(globalHome);

    // Copy default languages config
    const languagesFolder = globalLanguagePath();
    const languageStaticFolder = join(pathToStatic(), LANGUAGES);
    if (!existsSync(languagesFolder)) {
        copySync(languageStaticFolder, languagesFolder);
    } else {
        readdirSync(languageStaticFolder).forEach((languageName) => {
            if (!existsSync(join(languagesFolder, languageName))) {
                copySync(
                    join(languageStaticFolder, languageName),
                    join(languagesFolder, languageName)
                );
            }
        });
    }

    // Create checker folder
    const checkerFolder = join(globalHome, "checkers");
    createFolder(checkerFolder);

    // Copy testlib
    const testlib = "testlib.h";
    if (!existsSync(join(checkerFolder, testlib))) {
        copyFileSync(
            join(pathToStatic(), "checkers", testlib),
            join(checkerFolder, testlib)
        );
    }

    // Create wcmp checker
    const checkerName = "wcmp.cpp";
    if (!existsSync(join(checkerFolder, checkerName))) {
        copyFileSync(
            join(pathToStatic(), "checkers", checkerName),
            join(checkerFolder, checkerName)
        );
    }

    const atticFolder = join(globalHome, ATTIC);
    createFolder(atticFolder);

    // Compile checker
    let compiledName = "";
    if (os.platform() === "win32") {
        compiledName = "wcmp.exe";
    } else {
        compiledName = "wcmp";
    }

    if (!existsSync(join(checkerFolder, compiledName))) {
        const checkerPath = join(checkerFolder, checkerName);
        const compiledPath = join(checkerFolder, compiledName);
        preRun(checkerPath, compiledPath, globalHome, FRIEND_TIMEOUT);
    }
}

/**
 * Copy template file into `path` folder.
 *
 * @param path
 * @param template
 * @param override
 */
function copyFromTemplate(
    path: string,
    template: string,
    override: boolean
): string {
    const parts = template.split("@");

    if (parts.length === 1) {
        const fileName = basename(template);
        const target = join(path, fileName);

        if (override || !existsSync(target)) {
            copyFileSync(template, target);
        }

        return target;
    } else {
        if (!existsSync(join(parts[0], parts[1]))) {
            throw new Error(
                `Invalid template path ${template}. Target not found.`
            );
        }
        const folderPath = parts[0];
        copySync(folderPath, path);
        return join(path, parts[1]);
    }
}

function populateMainSolution(path: string, override: boolean): string {
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("solutionPath");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "sol.cpp");
    } else {
        templatePath = substituteArgWith(templatePath);
    }

    debug("newMainSolution", `Using template path: ${templatePath}`);

    return copyFromTemplate(path, templatePath, override);
}

export function newArena(path: string): ConfigFile {
    debug("newArena", `path: ${path}`);
    createFolder(path);

    const testcases = join(path, TESTCASES);
    createFolder(testcases);

    const attic = join(path, ATTIC);
    createFolder(attic);

    const config = ConfigFile.loadConfig(path, true).unwrapOr(
        ConfigFile.empty()
    );

    if (config.mainSolution.isNone()) {
        config.mainSolution = Option.some(populateMainSolution(path, true));
    }

    config.dump(path);

    return config;
}

export function testCasesName(path: string) {
    return readdirSync(join(path, TESTCASES))
        .filter(function (testCasePath) {
            return extname(testCasePath) === ".in";
        })
        .map(function (testCasePath) {
            return removeExtension(testCasePath);
        });
}

function addBruteSolution(path: string, config: ConfigFile) {
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("bruteTemplate");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "brute.cpp");
    }

    config.bruteSolution = Option.some(
        copyFromTemplate(path, templatePath, false)
    );
}

function addGenerator(path: string, config: ConfigFile) {
    // TODO(#51): Use tcgen
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("generatorTemplate");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "gen.py");
    }

    config.generator = Option.some(copyFromTemplate(path, templatePath, false));
}

function addChecker(path: string, config: ConfigFile) {
    const templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("checkerTemplate");

    if (templatePath === undefined || templatePath === "") {
        // Don't add default checker if not template was added
    } else {
        config.checker = Option.some(
            copyFromTemplate(path, templatePath, false)
        );
    }
}

export function upgradeArena(path: string) {
    const config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());

    // Load brute force solution
    if (
        config.bruteSolution.mapOr(true, (codePath) => {
            return !existsSync(codePath);
        })
    ) {
        addBruteSolution(path, config);
    }

    // Load generator
    if (
        config.generator.mapOr(true, (codePath) => {
            return !existsSync(codePath);
        })
    ) {
        addGenerator(path, config);
    }

    // Load checker
    if (
        config.checker.mapOr(true, (codePath) => {
            return !existsSync(codePath);
        })
    ) {
        addChecker(path, config);
    }

    config.dump(path);
}

function copyDefaultFilesToWorkspace(path: string) {
    const vscodeFolder = join(path, ".vscode");
    createFolder(vscodeFolder);

    const tasksPath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("tasks");

    if (tasksPath !== "") {
        if (tasksPath === undefined || !existsSync(tasksPath)) {
            vscode.window.showErrorMessage(`tasks file ${tasksPath} not found`);
        } else {
            copyFileSync(tasksPath, join(vscodeFolder, "tasks.json"));
        }
    }

    const launchPath: string | undefined = vscode.workspace
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

function newProblem(
    path: string,
    problem: Problem,
    isWorkspace: boolean
): ConfigFile {
    const config = newArena(path);

    if (isWorkspace) {
        copyDefaultFilesToWorkspace(path);
    }

    problem.inputs!.forEach((value, index) => {
        const fd = openSync(join(path, TESTCASES, `${index}.in`), "w");
        writeSync(fd, value);
        closeSync(fd);
    });

    problem.outputs!.forEach((value, index) => {
        const fd = openSync(join(path, TESTCASES, `${index}.ans`), "w");
        writeSync(fd, value);
        closeSync(fd);
    });

    return config;
}

export function newProblemFromId(
    path: string,
    site: SiteDescription,
    problemId: string
) {
    const problem = site.problemParser(problemId);

    path = join(path, problem.identifier!);

    newProblem(path, problem, true);

    return path;
}

function newContest(path: string, contest: Contest) {
    contest.problems!.forEach((problem) => {
        newProblem(join(path, problem.identifier!), problem, false);
    });
}

export function getSolutionPath() {
    const path_: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("library");

    if (path_ === undefined || path_ === "") {
        return undefined;
    }

    let path = substituteArgWith(path_);

    if (!isAbsolute(path)) {
        const cwd = vscode.workspace.rootPath;

        if (cwd === undefined) {
            return undefined;
        }

        path = join(cwd, path);
    }

    return path;
}

/**
 * Create new problem with configuration from competitive companion.
 *
 * @param config Json file with all data received from competitive companion.
 */
export function newProblemFromCompanion(
    config: CompanionConfig,
    tests: TestCase[]
) {
    const path = getSolutionPath();

    const contestPath = join(path!, config.group);
    createFolder(contestPath);

    const problemPath = join(contestPath, config.name);
    const inputs: string[] = [];
    const outputs: string[] = [];

    tests.forEach(function (testCase: TestCase) {
        inputs.push(testCase.input);
        outputs.push(testCase.output);
    });

    copyDefaultFilesToWorkspace(contestPath);

    const problemConfig = newProblem(
        problemPath,
        new Problem(config.name, config.name, inputs, outputs),
        false
    );

    problemConfig.setCompanionConfig(config);
    problemConfig.dump(problemPath);

    return new ProblemInContest(problemConfig, contestPath);
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
    const contest = site.contestParser(contestId);
    const contestPath = join(path, site.name, contest.name);

    createFolder(contestPath);
    copyDefaultFilesToWorkspace(contestPath);
    newContest(contestPath, contest);

    return contestPath;
}

export function timedRun(
    path: string,
    tcName: string,
    timeout: number,
    solution: CompileResult,
    checker: CompileResult
): TestCaseResult {
    const tcInput = join(path, TESTCASES, `${tcName}.in`);
    const tcOutput = join(path, TESTCASES, `${tcName}.ans`);
    const tcCurrent = join(path, TESTCASES, `${tcName}.out`);

    const tcData = readFileSync(tcInput, "utf8");

    const execution = run(
        solution.code,
        solution.getOutput(),
        path,
        tcData,
        timeout
    );

    const timeSpan = execution.timeSpan.unwrap();
    const stdout = execution.stdout().toString();
    const stderr = execution.stderr().toString();

    writeBufferToFileSync(tcCurrent, execution.stdout());

    // Check if an error happened
    if (execution.failed()) {
        if (execution.isTLE()) {
            return new TestCaseResult(Verdict.TLE, timeSpan, stdout, stderr);
        } else {
            return new TestCaseResult(Verdict.RTE, timeSpan, stdout, stderr);
        }
    }

    // Check output is ok
    const checkerExecution = runWithArgs(
        checker.code,
        checker.getOutput(),
        join(path, ATTIC),
        "",
        FRIEND_TIMEOUT,
        [tcInput, tcCurrent, tcOutput]
    );

    if (checkerExecution.isTLE()) {
        return new TestCaseResult(Verdict.FAIL, timeSpan, stdout, stderr);
    } else if (checkerExecution.failed()) {
        return new TestCaseResult(Verdict.WA, timeSpan, stdout, stderr);
    } else {
        return new TestCaseResult(Verdict.OK, timeSpan, stdout, stderr);
    }
}

/**
 * Test a solution for a problem.
 * Return Option.none if an error happened.
 *
 * @param path
 */
export function testSolution(path: string): Option<SolutionResult> {
    const config = ConfigFile.loadConfig(path, true).unwrap();

    // Load main solution (compile if necessary)
    const mainSolution_ = getMainSolutionPath(path, config);
    if (mainSolution_.isNone()) {
        return Option.none();
    }
    const mainSolution = mainSolution_.unwrap();

    // Load checker (compile if necessary)
    const checker_ = getCheckerPath(path, config);
    if (checker_.isNone()) {
        return Option.none();
    }
    const checker = checker_.unwrap();

    let testcasesId = testCasesName(path);

    if (testcasesId.length === 0) {
        return Option.some(new SolutionResult(Verdict.NO_TESTCASES));
    }

    // Process all testcases in sorted order
    testcasesId.sort();

    // Run current test case first (if it exists)
    const startTestCase_ = currentTestCase();

    if (startTestCase_.isSome()) {
        const startTestCase = startTestCase_.unwrap();
        testcasesId = testcasesId
            .reverse()
            .filter((name) => name !== startTestCase);
        testcasesId.push(startTestCase);
        testcasesId = testcasesId.reverse();
    }

    const results: TestCaseResult[] = [];
    let fail = Option.none<SolutionResult>();

    // Try to find time limit from local config first, otherwise use global time limit.
    // TODO: Add to wiki about this feature, and how to change custom time limit.
    const timeout = config.timeLimit().unwrapOr(getTimeout());

    testcasesId.forEach((tcId) => {
        // Run on each test case and break on first failing case.
        if (fail.isNone()) {
            const tcResult = timedRun(
                path,
                tcId,
                timeout,
                mainSolution,
                checker
            );

            if (!tcResult.isOk()) {
                fail = Option.some(new SolutionResult(tcResult.status, tcId));
            }

            results.push(tcResult);
        }
    });

    if (fail.isNone()) {
        let maxTime = 0;
        for (let i = 0; i < results.length; i++) {
            if (results[i].spanTime! > maxTime) {
                maxTime = results[i].spanTime!;
            }
        }
        return Option.some(new SolutionResult(Verdict.OK, undefined, maxTime));
    } else {
        return fail;
    }
}

/**
 * Try to compile code. Output binary (if necessary) will be stored on output.
 * If there is no output binary, CompileResult.output will be Option.none
 * If it fail to compile the code answer will be Option.none
 *
 * @param code Code to compile
 * @param output Place to store result
 * @param path Path to the problem (relevant to store errors if occurred)
 */
function getCompileResult(
    code: string,
    output: string,
    path: string
): Option<CompileResult> {
    const execution = preRun(code, output, path, FRIEND_TIMEOUT);

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
 * Find main solution from config. Compile it if necessary.
 * Return Option.none if fail.
 *
 * @param path
 */
export function getMainSolutionPath(
    path: string,
    config: ConfigFile
): Option<CompileResult> {
    if (config.mainSolution.isNone()) {
        vscode.window.showErrorMessage(
            "Set main solution or open a coding environment."
        );
        return Option.none();
    }

    const mainSolution = config.mainSolution.unwrap();
    let mainSolutionOutput = "";
    if (os.platform() === "win32") {
        mainSolutionOutput = join(path, ATTIC, "sol.exe");
    } else {
        mainSolutionOutput = join(path, ATTIC, "sol");
    }

    if (!existsSync(mainSolution)) {
        vscode.window.showErrorMessage(
            `Main solution ${mainSolution} doesn't exists. Open a coding environment.`
        );
        return Option.none();
    }

    return getCompileResult(mainSolution, mainSolutionOutput, path);
}

/**
 * Find generator from config. Compile it if necessary.
 * Return Option.none if fail.
 *
 * @param path
 */
function getGeneratorPath(
    path: string,
    config: ConfigFile
): Option<CompileResult> {
    if (config.generator.isNone()) {
        vscode.window.showErrorMessage(
            "No generator found. Upgrade environment first."
        );
        return Option.none();
    }

    const generatorCode = config.generator.unwrap();
    let generatorOutput = "";

    if (os.platform() === "win32") {
        generatorOutput = join(path, ATTIC, "generator.exe");
    } else {
        generatorOutput = join(path, ATTIC, "generator");
    }

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
 * Return Option.none if fail.
 *
 * @param path
 */
function getBrutePath(path: string, config: ConfigFile): Option<CompileResult> {
    if (config.bruteSolution.isNone()) {
        vscode.window.showErrorMessage(
            "No brute solution found. Upgrade environment first."
        );
        return Option.none();
    }

    const bruteCode = config.bruteSolution.unwrap();
    let bruteOutput = "";
    if (os.platform() === "win32") {
        bruteOutput = join(path, ATTIC, "brute.exe");
    } else {
        bruteOutput = join(path, ATTIC, "brute");
    }

    if (!existsSync(bruteCode)) {
        vscode.window.showErrorMessage(
            "No brute solution found. Upgrade environment first."
        );
        return Option.none();
    }

    return getCompileResult(bruteCode, bruteOutput, path);
}

/**
 * Find checker path for current problem. First look in the config file
 * Otherwise use wcmp (checker that compare by token).
 *
 * If local checker is found try to compile it.
 */
export function getCheckerPath(
    path: string,
    config: ConfigFile
): Option<CompileResult> {
    const globalHome = globalHomePath();
    const globalCheckerCode = join(globalHome, "checkers", "wcmp.cpp");
    let globalCheckerOutput = "";

    if (os.platform() === "win32") {
        globalCheckerOutput = join(globalHome, "checkers", "wcmp.exe");
    } else {
        globalCheckerOutput = join(globalHome, "checkers", "wcmp");
    }
    const globalChecker = preRun(
        globalCheckerCode,
        globalCheckerOutput,
        globalHome,
        FRIEND_TIMEOUT
    );

    if (globalChecker.isNone()) {
        return Option.none();
    }

    if (config.checker.isNone()) {
        return Option.some(
            new CompileResult(globalCheckerCode, globalCheckerOutput)
        );
    }

    const checkerCode = config.checker.unwrap();
    let checkerOutput = "";
    if (os.platform() === "win32") {
        checkerOutput = join(path, ATTIC, CHECKER_BINARY + ".exe");
    } else {
        checkerOutput = join(path, ATTIC, CHECKER_BINARY);
    }

    if (!existsSync(checkerCode)) {
        return Option.some(
            new CompileResult(globalCheckerCode, globalCheckerOutput)
        );
    } else {
        return getCompileResult(checkerCode, checkerOutput, path);
    }
}

function generateTestCase(path: string, generator: CompileResult) {
    const genExecution = run(
        generator.code,
        generator.getOutput(),
        path,
        "",
        FRIEND_TIMEOUT
    );

    if (genExecution.failed()) {
        throw new Error("Failed generating test case.");
    }

    writeBufferToFileSync(
        join(path, TESTCASES, GENERATED_TEST_CASE + ".in"),
        genExecution.stdout()
    );
}

export async function stressSolution(path: string, times: number) {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            cancellable: true,
            title: "Stressing",
        },
        async (progress, token) => {
            let cancelled = false;
            token.onCancellationRequested(() => {
                cancelled = true;
            });

            async function reportProgress(inc: number, msg?: string) {
                progress.report({ increment: inc, message: msg });
                await sleep(0);
            }

            const config = ConfigFile.loadConfig(path, true).unwrap();

            await reportProgress(0, "loading main solution.");
            // Load main solution (compile if necessary)
            const mainSolution_ = getMainSolutionPath(path, config);
            if (mainSolution_.isNone()) {
                return;
            }
            const mainSolution = mainSolution_.unwrap();

            await reportProgress(0, "loading brute solution.");
            // Load brute solution (compile if necessary)
            const bruteSolution_ = getBrutePath(path, config);
            if (bruteSolution_.isNone()) {
                return;
            }
            const bruteSolution = bruteSolution_.unwrap();

            await reportProgress(0, "loading generator.");
            // Load generator solution (compile if necessary)
            const generator_ = getGeneratorPath(path, config);
            if (generator_.isNone()) {
                return;
            }
            const generator = generator_.unwrap();

            await reportProgress(0, "loading checker.");
            // Load checker solution (compile if necessary)
            const checker_ = getCheckerPath(path, config);
            if (checker_.isNone()) {
                return;
            }
            const checker = checker_.unwrap();

            const timeout = config.timeLimit().unwrapOr(getTimeout());

            await reportProgress(0, "0%");
            let percent = 0;
            for (let index = 0; index < times && !cancelled; index++) {
                // Generate input test case
                generateTestCase(path, generator);

                // Generate output test case from brute.cpp
                const tcData = readFileSync(
                    join(path, TESTCASES, GENERATED_TEST_CASE + ".in"),
                    "utf8"
                );

                if (cancelled) {
                    return;
                }

                const bruteExecution = run(
                    bruteSolution.code,
                    bruteSolution.getOutput(),
                    path,
                    tcData,
                    FRIEND_TIMEOUT
                );

                if (bruteExecution.failed()) {
                    vscode.window.showErrorMessage(
                        "Brute solution failed: " +
                            bruteExecution.stderr.toString()
                    );
                    return;
                }

                if (cancelled) {
                    return;
                }

                // Finally write .ans
                writeBufferToFileSync(
                    join(path, TESTCASES, GENERATED_TEST_CASE + ".ans"),
                    bruteExecution.stdout()
                );

                // Check sol report same result than brute
                const result = timedRun(
                    path,
                    GENERATED_TEST_CASE,
                    timeout,
                    mainSolution,
                    checker
                );

                if (!result.isOk()) {
                    // now save the test case
                    let index = 0;
                    const testcases = testCasesName(path).filter(
                        (test) => test.search("gen") === -1
                    );
                    if (testcases.length) {
                        index =
                            testcases
                                .map((test) => parseInt(test))
                                .reduce((i1, i2) => Math.max(i1, i2)) + 1;
                    }
                    renameSync(
                        join(path, TESTCASES, `gen.in`),
                        join(path, TESTCASES, `${index}.in`)
                    );
                    if (existsSync(join(path, TESTCASES, `gen.ans`))) {
                        renameSync(
                            join(path, TESTCASES, `gen.ans`),
                            join(path, TESTCASES, `${index}.ans`)
                        );
                    }
                    if (existsSync(join(path, TESTCASES, `gen.out`))) {
                        renameSync(
                            join(path, TESTCASES, `gen.out`),
                            join(path, TESTCASES, `${index}.out`)
                        );
                    }
                    vscode.window.showInformationMessage(
                        `${verdictName(result.status)} on testcase ${index}.in`
                    );
                    checkLaunchWebview(); // reload webview to show the new testcase
                    //selectDebugTestCase() automatically select it to debug ??
                    return;
                }

                const newPercent = ((index + 1) * 100) / times;
                if (newPercent !== percent) {
                    await reportProgress(
                        newPercent - percent,
                        newPercent.toString() + "%"
                    );
                    percent = newPercent;
                }
            }

            if (!cancelled) {
                vscode.window.showInformationMessage(
                    `Stress passed ${times} testcases :(`
                );
            }
        }
    );
}
