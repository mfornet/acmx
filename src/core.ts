"use strict";
import {
    closeSync,
    copyFileSync,
    existsSync,
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
    ATTIC,
    FRIEND_TIMEOUT,
    LANGUAGES,
    TESTCASES,
    ConfigFile,
    CHECKER_BINARY,
    GENERATED_TEST_CASE,
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

/**
 * Path to static folder.
 */
export function pathToStatic() {
    return join(dirname(dirname(__filename)), "static");
}

/**
 * Path to main solution for given problem.
 * If main solution doesn't exist, it is created.
 *
 * @param path Problem path
 */
export function mainSolution(path: string): string {
    let config = ConfigFile.loadConfig(path);
    if (config.mainSolution.isNone()) {
        config.mainSolution = Option.some(populateMainSolution(path, false));
    }
    let mainSolution = config.mainSolution.unwrap();
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

export function currentTestCase(): Option<string> {
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
export function globalHomePath(
    testPath: string | undefined = undefined
): string {
    if (testPath !== undefined) {
        return testPath;
    }

    let path_: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("homePath");

    let path = path_!;

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

    let atticFolder = join(globalHome, ATTIC);
    createFolder(atticFolder);

    // Compile checker
    let compiledName = "wcmp";
    if (!existsSync(join(checkerFolder, compiledName))) {
        let checkerPath = join(checkerFolder, checkerName);
        let compiledPath = join(checkerFolder, compiledName);
        preRun(checkerPath, compiledPath, globalHome, FRIEND_TIMEOUT);
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
    let parts = template.split("@");

    if (parts.length == 1) {
        let fileName = basename(template);
        let target = join(path, fileName);

        if (override || !existsSync(target)) {
            copyFileSync(template, target);
        }

        return target;
    } else {
        if (!existsSync(join(parts[0], parts[1]))) {
            throw `Invalid template path ${template}. Target not found.`;
        }
        let folderPath = parts[0];
        copySync(folderPath, path);
        return join(path, parts[1]);
    }
}

function populateMainSolution(path: string, override: boolean): string {
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("templatePath");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "sol.cpp");
    } else {
        templatePath = substituteArgWith(templatePath);
    }

    debug("newMainSolution", `Using template path: ${templatePath}`);

    return copyFromTemplate(path, templatePath, override);
}

export function newArena(path: string) {
    debug("newArena", `path: ${path}`);
    createFolder(path);

    let testcases = join(path, TESTCASES);
    createFolder(testcases);

    let attic = join(path, ATTIC);
    createFolder(attic);

    let config = ConfigFile.empty();
    try {
        // Try to load current config file if it exists.
        config = ConfigFile.loadConfig(path);
    } catch (err) {}

    if (config.mainSolution.isNone()) {
        config.mainSolution = Option.some(populateMainSolution(path, true));
    }

    config.dump(path);
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
    let templatePath: string | undefined = vscode.workspace
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
    let config = ConfigFile.loadConfig(path);

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

function newProblem(path: string, problem: Problem, isWorkspace: boolean) {
    newArena(path);

    if (isWorkspace) {
        copyDefaultFilesToWorkspace(path);
    }

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

    newProblem(path, problem, true);

    return path;
}

function newContest(path: string, contest: Contest) {
    contest.problems!.forEach((problem) => {
        newProblem(join(path, problem.identifier!), problem, false);
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

    config.tests.forEach(function (testCase: any) {
        inputs.push(testCase.input);
        outputs.push(testCase.output);
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
    let contest = site.contestParser(contestId);
    let contestPath = join(path, site.name, contest.name);

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
    let tcInput = join(path, TESTCASES, `${tcName}.in`);
    let tcOutput = join(path, TESTCASES, `${tcName}.out`);
    let tcCurrent = join(path, TESTCASES, `${tcName}.real`);

    let tcData = readFileSync(tcInput, "utf8");

    let execution = run(
        solution.code,
        solution.getOutput(),
        path,
        tcData,
        timeout
    );

    let timeSpan = execution.timeSpan.unwrap();

    // Check if an error happened
    if (execution.failed()) {
        if (execution.isTLE()) {
            return new TestCaseResult(Verdict.TLE);
        } else {
            return new TestCaseResult(Verdict.RTE);
        }
    }

    // Check output is ok
    writeBufferToFileSync(tcCurrent, execution.stdout());

    let checkerExecution = runWithArgs(
        checker.code,
        checker.getOutput(),
        join(path, ATTIC),
        "",
        FRIEND_TIMEOUT,
        [tcInput, tcCurrent, tcOutput]
    );

    if (checkerExecution.isTLE()) {
        return new TestCaseResult(Verdict.FAIL);
    } else if (checkerExecution.failed()) {
        return new TestCaseResult(Verdict.WA);
    } else {
        return new TestCaseResult(Verdict.OK, timeSpan);
    }
}

/**
 * Test a solution for a problem.
 * Return Option.none if an error happened.
 *
 * @param path
 */
export function testSolution(path: string): Option<SolutionResult> {
    let config = ConfigFile.loadConfig(path);

    // Load main solution (compile if necessary)
    let mainSolution_ = getMainSolutionPath(path, config);
    if (mainSolution_.isNone()) {
        return Option.none();
    }
    let mainSolution = mainSolution_.unwrap();

    // Load checker (compile if necessary)
    let checker_ = getCheckerPath(path, config);
    if (checker_.isNone()) {
        return Option.none();
    }
    let checker = checker_.unwrap();

    let testcasesId = testCasesName(path);

    if (testcasesId.length === 0) {
        return Option.some(new SolutionResult(Verdict.NO_TESTCASES));
    }

    // Process all testcases in sorted order
    testcasesId.sort();

    // Run current test case first (if it exists)
    let startTestCase_ = currentTestCase();

    if (startTestCase_.isSome()) {
        let startTestCase = startTestCase_.unwrap();
        testcasesId = testcasesId
            .reverse()
            .filter((name) => name !== startTestCase);
        testcasesId.push(startTestCase);
        testcasesId = testcasesId.reverse();
    }

    let results: TestCaseResult[] = [];
    let fail = Option.none<SolutionResult>();

    testcasesId.forEach((tcId) => {
        // Run on each test case and break on first failing case.
        if (fail.isNone()) {
            let tcResult = timedRun(
                path,
                tcId,
                getTimeout(),
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
 * Find main solution from config. Compile it if necessary.
 * Return Option.none if fail.
 *
 * @param path
 */
function getMainSolutionPath(
    path: string,
    config: ConfigFile
): Option<CompileResult> {
    if (config.mainSolution.isNone()) {
        vscode.window.showErrorMessage("Open a coding environment.");
        return Option.none();
    }

    let mainSolution = config.mainSolution.unwrap();
    let mainSolutionOutput = join(path, ATTIC, "sol");

    if (!existsSync(mainSolution)) {
        vscode.window.showErrorMessage("Open a coding environment.");
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

    let generatorCode = config.generator.unwrap();
    let generatorOutput = join(path, ATTIC, "generator");

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

    let bruteCode = config.bruteSolution.unwrap();
    let bruteOutput = join(path, ATTIC, "brute");

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
function getCheckerPath(
    path: string,
    config: ConfigFile
): Option<CompileResult> {
    let globalHome = globalHomePath();
    let globalCheckerCode = join(globalHome, "checkers", "wcmp.cpp");
    let globalCheckerOutput = join(globalHome, "checkers", "wcmp");

    let globalChecker = preRun(
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

    let checkerCode = config.checker.unwrap();
    let checkerOutput = join(path, ATTIC, CHECKER_BINARY);

    if (!existsSync(checkerCode)) {
        return Option.some(
            new CompileResult(globalCheckerCode, globalCheckerOutput)
        );
    } else {
        return getCompileResult(checkerCode, checkerOutput, path);
    }
}

function generateTestCase(path: string, generator: CompileResult) {
    let genExecution = run(
        generator.code,
        generator.getOutput(),
        path,
        "",
        FRIEND_TIMEOUT
    );

    if (genExecution.failed()) {
        throw "Failed generating test case.";
    }

    writeBufferToFileSync(
        join(path, TESTCASES, GENERATED_TEST_CASE + ".in"),
        genExecution.stdout()
    );
}

export function stressSolution(
    path: string,
    times: number
): Option<SolutionResult> {
    let config = ConfigFile.loadConfig(path);

    // Load main solution (compile if necessary)
    let mainSolution_ = getMainSolutionPath(path, config);
    if (mainSolution_.isNone()) {
        return Option.none();
    }
    let mainSolution = mainSolution_.unwrap();

    // Load brute solution (compile if necessary)
    let bruteSolution_ = getBrutePath(path, config);
    if (bruteSolution_.isNone()) {
        return Option.none();
    }
    let bruteSolution = bruteSolution_.unwrap();

    // Load generator solution (compile if necessary)
    let generator_ = getGeneratorPath(path, config);
    if (generator_.isNone()) {
        return Option.none();
    }
    let generator = generator_.unwrap();

    // Load checker solution (compile if necessary)
    let checker_ = getCheckerPath(path, config);
    if (checker_.isNone()) {
        return Option.none();
    }
    let checker = checker_.unwrap();

    let results = [];

    for (let index = 0; index < times; index++) {
        // Generate input test case
        generateTestCase(path, generator);

        // Generate output test case from brute.cpp
        let tcData = readFileSync(
            join(path, TESTCASES, GENERATED_TEST_CASE + ".in"),
            "utf8"
        );

        let bruteExecution = run(
            bruteSolution.code,
            bruteSolution.getOutput(),
            path,
            tcData,
            FRIEND_TIMEOUT
        );

        if (bruteExecution.failed()) {
            return Option.some(
                new SolutionResult(Verdict.FAIL, GENERATED_TEST_CASE)
            );
        }

        // Finally write .out
        writeBufferToFileSync(
            join(path, TESTCASES, GENERATED_TEST_CASE + ".out"),
            bruteExecution.stdout()
        );

        // Check sol report same result than brute
        let result = timedRun(
            path,
            GENERATED_TEST_CASE,
            getTimeout(),
            mainSolution,
            checker
        );

        if (!result.isOk()) {
            return Option.some(
                new SolutionResult(result.status, GENERATED_TEST_CASE)
            );
        }

        results.push(result);
    }

    let maxTime = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i]!.spanTime! > maxTime) {
            maxTime = results[i]!.spanTime!;
        }
    }

    return Option.some(new SolutionResult(Verdict.OK, undefined, maxTime));
}
