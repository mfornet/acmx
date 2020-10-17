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
import { spawnSync } from "child_process";

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
    let config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
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
    return ext === ".in" || ext === ".ans" || ext === ".out";
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
export function globalHomePath(testPath?: string): string {
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
    let globalHome = globalHomePath(testPath)!;
    createFolder(globalHome);

    // Copy default languages config
    let languagesFolder = globalLanguagePath();
    let languageStaticFolder = join(pathToStatic(), LANGUAGES);
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

    if (parts.length === 1) {
        let fileName = basename(template);
        let target = join(path, fileName);

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
        let folderPath = parts[0];
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

    let testcases = join(path, TESTCASES);
    createFolder(testcases);

    let attic = join(path, ATTIC);
    createFolder(attic);

    let config = ConfigFile.loadConfig(path, true).unwrapOr(ConfigFile.empty());

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

async function addGenerator(path: string, config: ConfigFile) {
    let templatePath: string | undefined = vscode.workspace
        .getConfiguration("acmx.template", null)
        .get("generatorTemplate");

    if (templatePath === undefined || templatePath === "") {
        templatePath = join(pathToStatic(), "templates", "gen.py");
    }

    var gen_path = Option.some(copyFromTemplate(path, templatePath, false));

    config.generator = gen_path;
    spawnSync("python", ["-m", `tcgen`, "--path", `${join(path, TESTCASES)}`, "--output", `${gen_path.unwrap()}`]);

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
    let config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());

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

function newProblem(
    path: string,
    problem: Problem,
    isWorkspace: boolean
): ConfigFile {
    let config = newArena(path);

    if (isWorkspace) {
        copyDefaultFilesToWorkspace(path);
    }

    problem.inputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.in`), "w");
        writeSync(fd, value);
        closeSync(fd);
    });

    problem.outputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.ans`), "w");
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
    let path_: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("library");

    if (path_ === undefined || path_ === "") {
        return undefined;
    }

    let path = substituteArgWith(path_);

    if (!isAbsolute(path)) {
        let cwd = vscode.workspace.rootPath;

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
    let path = getSolutionPath();

    let contestPath = join(path!, config.group);
    createFolder(contestPath);

    let problemPath = join(contestPath, config.name);
    let inputs: string[] = [];
    let outputs: string[] = [];

    tests.forEach(function (testCase: TestCase) {
        inputs.push(testCase.input);
        outputs.push(testCase.output);
    });

    copyDefaultFilesToWorkspace(contestPath);

    let problemConfig = newProblem(
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
    let tcOutput = join(path, TESTCASES, `${tcName}.ans`);
    let tcCurrent = join(path, TESTCASES, `${tcName}.out`);

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
    let config = ConfigFile.loadConfig(path, true).unwrap();

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

    // Try to find time limit from local config first, otherwise use global time limit.
    // TODO: Add to wiki about this feature, and how to change custom time limit.
    let timeout = config.timeLimit().unwrapOr(getTimeout());

    testcasesId.forEach((tcId) => {
        // Run on each test case and break on first failing case.
        if (fail.isNone()) {
            let tcResult = timedRun(path, tcId, timeout, mainSolution, checker);

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

    let mainSolution = config.mainSolution.unwrap();
    let mainSolutionOutput = join(path, ATTIC, "sol");

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
        throw new Error("Failed generating test case.");
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
    let config = ConfigFile.loadConfig(path, true).unwrap();

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

    let timeout = config.timeLimit().unwrapOr(getTimeout());

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

        // Finally write .ans
        writeBufferToFileSync(
            join(path, TESTCASES, GENERATED_TEST_CASE + ".ans"),
            bruteExecution.stdout()
        );

        // Check sol report same result than brute
        let result = timedRun(
            path,
            GENERATED_TEST_CASE,
            timeout,
            mainSolution,
            checker
        );

        if (!result.isOk()) {
            // now save the test case
            let index = 0;
            while (existsSync(join(path, TESTCASES, `gen.${index}.in`))) {
                index += 1;
            }
            renameSync(
                join(path, TESTCASES, `gen.in`),
                join(path, TESTCASES, `gen.${index}.in`)
            );
            if (existsSync(join(path, TESTCASES, `gen.ans`))) {
                renameSync(
                    join(path, TESTCASES, `gen.ans`),
                    join(path, TESTCASES, `gen.${index}.ans`)
                );
            }
            if (existsSync(join(path, TESTCASES, `gen.out`))) {
                renameSync(
                    join(path, TESTCASES, `gen.out`),
                    join(path, TESTCASES, `gen.${index}.out`)
                );
            }
            return Option.some(
                new SolutionResult(result.status, `gen.${index}`)
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
