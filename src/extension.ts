"use strict";
import {
    closeSync,
    copyFileSync,
    existsSync,
    openSync,
    readdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
    writeSync,
} from "fs";
import { basename, dirname, extname, join } from "path";
import * as vscode from "vscode";
import { startCompetitiveCompanionService } from "./companion";
import { EMPTY } from "./conn";
import {
    currentProblem,
    getSolutionPath,
    initAcmX,
    newContestFromId,
    newProblemFromId,
    pathToStatic,
    stressSolution,
    testSolution,
    upgradeArena,
    mainSolution,
    globalLanguagePath,
    getMainSolutionPath,
} from "./core";
import {
    SiteDescription,
    Verdict,
    ATTIC,
    FRIEND_TIMEOUT,
    verdictName,
    ConfigFile,
    Option,
    TESTCASES,
} from "./primitives";
import * as clipboardy from "clipboardy";
import * as tmp from "tmp";
import { debug, getExtension, removeExtension } from "./utils";
import { preRun, runSingle } from "./runner";
import { acmxTerminal } from "./terminal";

import {
    editorChanged,
    editorClosed,
    checkLaunchWebview,
} from "./webview/editorChange";

import { getRetainWebviewContextPref } from "./webview/types";

import JudgeViewProvider from "./webview/JudgeView";
import { RunTestCases } from "./webview/core";

let judgeViewProvider: JudgeViewProvider;

export const getJudgeViewProvider = () => {
    return judgeViewProvider;
};

// Create a new problem
export async function addProblem() {
    // Use default site when creating a problem from the vscode.
    const site: SiteDescription = EMPTY;

    const id = await vscode.window.showInputBox({
        placeHolder: site.problemIdPlaceholder,
    });

    if (id === undefined) {
        vscode.window.showErrorMessage("Problem ID not provided.");
        return;
    }

    let path = getSolutionPath();
    path = join(path!, site.name, "single");

    const problemPath = newProblemFromId(path, site, id);

    await vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(problemPath)
    );
}

function parseNumberOfProblems(numberOfProblems: string | undefined) {
    if (numberOfProblems === undefined) {
        return undefined;
    }

    numberOfProblems = numberOfProblems.toLowerCase();

    if (numberOfProblems.length === 1) {
        const value = numberOfProblems.charCodeAt(0);
        if (97 <= value && value <= 122) {
            return value - 97 + 1;
        }
    }

    const res = Number.parseInt(numberOfProblems);

    if (Number.isNaN(res)) {
        return undefined;
    } else {
        return res;
    }
}

async function addContest() {
    const path = getSolutionPath();
    const site: SiteDescription = EMPTY;

    let id = undefined;

    const name = await vscode.window.showInputBox({
        placeHolder: site.contestIdPlaceholder,
    });

    if (name === undefined) {
        vscode.window.showErrorMessage("Name not provided.");
        return;
    }

    const probCountStr = await vscode.window.showInputBox({
        placeHolder: "Number of problems",
    });
    const probCount = parseNumberOfProblems(probCountStr);

    if (probCount === undefined) {
        vscode.window.showErrorMessage("Number of problems not provided.");
        return;
    }

    id = name + "-" + probCount.toString();

    const contestPath = await newContestFromId(path!, site, id);

    vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(contestPath)
    );
}

async function debugTestCase(path: string, tcId: string) {
    // Change editor layout to show failing test
    await vscode.commands.executeCommand("vscode.setEditorLayout", {
        orientation: 0,
        groups: [
            { groups: [{}], size: 0.5 },
            {
                groups: [{ groups: [{}, {}] }, {}],
                size: 0.5,
            },
        ],
    });

    const sol = mainSolution(path);
    const inp = join(path, TESTCASES, `${tcId}.in`);
    const ans = join(path, TESTCASES, `${tcId}.ans`);
    const out = join(path, TESTCASES, `${tcId}.out`);

    await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(sol),
        vscode.ViewColumn.One
    );
    await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(inp),
        vscode.ViewColumn.Two
    );
    // This file might not exist!
    if (existsSync(out)) {
        await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(ans),
            vscode.ViewColumn.Three
        );
        await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(out),
            vscode.ViewColumn.Four
        );
    } else {
        await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(ans),
            vscode.ViewColumn.Four
        );
    }
}

async function runSolution() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();
    debug("run-solution", `${path}`);

    await vscode.window.activeTextEditor?.document.save().then(() => {
        const result_ = testSolution(path);

        if (result_.isNone()) {
            return;
        }

        const result = result_.unwrap();

        if (result.isOk()) {
            vscode.window.showInformationMessage(
                `OK. Time ${result.getMaxTime()}ms`
            );
        } else if (result.status === Verdict.NO_TESTCASES) {
            vscode.window.showErrorMessage(`No testcases.`);
        } else {
            const failTestCaseId = result.getFailTestCaseId();
            vscode.window.showErrorMessage(
                `${verdictName(result.status)} on test ${failTestCaseId}`
            );
            debugTestCase(path, failTestCaseId);
        }
    });
}

async function compile() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    debug("compile", `${path}`);

    const sol = mainSolution(path);
    const out = join(path, ATTIC, "sol");

    if (!existsSync(sol)) {
        vscode.window.showErrorMessage("Open a coding environment first.");
        return;
    }

    await vscode.window.activeTextEditor?.document.save().then(() => {
        // Compile solution
        const result = preRun(sol, out, path!, FRIEND_TIMEOUT);

        if (result.isNone()) {
            vscode.window.showInformationMessage("No compilation needed.");
        } else if (!result.unwrap().failed()) {
            let message = "";
            if (result.unwrap().getCached()) {
                message = " (cached)";
            } else if (result.unwrap().stderr().length > 0) {
                message = " with warnings";
            }
            vscode.window.showInformationMessage(
                "Compilation successful" + message + "."
            );
        }
    });
}

async function openTestCase() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();
    const testCases: any[] = [];

    // Read testcases
    readdirSync(join(path, TESTCASES))
        .filter(function (testCasePath) {
            return extname(testCasePath) === ".in";
        })
        .map(function (testCasePath) {
            const name = removeExtension(testCasePath);

            testCases.push({
                label: name,
                target: name,
            });
        });

    const tc = await vscode.window.showQuickPick(testCases, {
        placeHolder: "Select test case",
    });

    if (tc !== undefined) {
        const inp = join(path, TESTCASES, `${tc.target}.in`);
        const out = join(path, TESTCASES, `${tc.target}.ans`);

        await vscode.commands.executeCommand("vscode.setEditorLayout", {
            orientation: 0,
            groups: [{}, {}],
        });
        await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(inp),
            vscode.ViewColumn.One
        );
        await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(out),
            vscode.ViewColumn.Two
        );
    }
}

async function addTestCase() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    let index = 0;
    while (existsSync(join(path, TESTCASES, `${index}.hand.in`))) {
        index += 1;
    }

    const inp = join(path, TESTCASES, `${index}.hand.in`);
    const out = join(path, TESTCASES, `${index}.hand.ans`);

    writeFileSync(inp, "");
    writeFileSync(out, "");

    await vscode.commands.executeCommand("vscode.setEditorLayout", {
        orientation: 0,
        groups: [{}, {}],
    });
    await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(inp),
        vscode.ViewColumn.One
    );
    await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(out),
        vscode.ViewColumn.Two
    );
}

async function coding() {
    vscode.window.terminals.forEach((ter) => {
        ter.hide();
    }); //hides terminals

    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    await vscode.commands.executeCommand("vscode.setEditorLayout", {
        groups: [{}],
    });

    const sol = mainSolution(path);

    await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(sol),
        vscode.ViewColumn.One
    );
}

async function stress() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    const _stressTimes: number | undefined = vscode.workspace
        .getConfiguration("acmx.stress", null)
        .get("times");

    // Default stress times is 10
    let stressTimes = 10;

    if (_stressTimes !== undefined) {
        stressTimes = _stressTimes;
    }

    await vscode.window.activeTextEditor?.document.save().then(async () => {
        await stressSolution(path, stressTimes);
    });
}

async function upgrade() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    upgradeArena(path);
}

function fileList(dir: string): string[] {
    return readdirSync(dir).reduce((list: string[], file: string) => {
        return list.concat([file]);
    }, []);
}

async function setChecker() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    const allCheckersPlain = fileList(join(pathToStatic(), "checkers")).filter(
        (name: string) => name !== "testlib.h"
    );
    const allChecker = allCheckersPlain.map((value: string) => {
        const data = readFileSync(
            join(pathToStatic(), "checkers", value),
            "utf8"
        );
        const regex = /setName\("(.*?)"\)/;
        const matched = regex.exec(data)![1];
        return {
            label: value.slice(0, value.length - 4),
            detail: matched,
            target: value,
        };
    });

    const checkerInfo = await vscode.window.showQuickPick(allChecker, {
        placeHolder: "Select custom checker.",
    });

    if (checkerInfo === undefined) {
        vscode.window.showErrorMessage("Checker not provided.");
        return;
    }

    const checker = checkerInfo.target;

    const checkerPath = join(pathToStatic(), "checkers", checker);
    const checkerDest = join(path, ATTIC, "checker.cpp");

    copyFileSync(checkerPath, checkerDest);
    const config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.checker = Option.some(checkerDest);
    config.dump(path);
}

export async function selectDebugTestCase(uriPath: vscode.Uri) {
    const testCaseName = basename(uriPath.path);
    let path = dirname(uriPath.path);

    const MAX_DEPTH = 2;

    for (let i = 0; i < MAX_DEPTH && !existsSync(join(path, ".vscode")); i++) {
        path = dirname(path);
    }

    const launchTaskPath = join(path, ".vscode", "launch.json");

    if (!existsSync(launchTaskPath)) {
        return undefined;
    }

    const launchTaskData = readFileSync(launchTaskPath, "utf8");
    // TODO(#20): Don't use regular expression to replace this. Use JSON parser instead.
    const newTaskData = launchTaskData.replace(
        /"args":.+/,
        `"args": ["<", "\${fileDirname}/testcases/${testCaseName}"],`
    );
    const launchTaskFdW = openSync(launchTaskPath, "w");
    writeSync(launchTaskFdW, newTaskData);
    closeSync(launchTaskFdW);
}

async function selectMainSolution(uriPath: vscode.Uri) {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    const config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.mainSolution = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

async function selectBruteSolution(uriPath: vscode.Uri) {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    const config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.bruteSolution = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

async function selectGenerator(uriPath: vscode.Uri) {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    const config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.generator = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

async function selectChecker(uriPath: vscode.Uri) {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();

    const config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.checker = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

function assignedCopyToClipboardCommand(): boolean {
    const generateCodeCommand:
        | string
        | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("copyToClipboardCommand");
    return generateCodeCommand !== undefined;
}

// Run `copyToClipboardCommand` command to convert current code
// in code ready for submission. This is useful when we want to apply
// some filters to the code, or some libraries should be inlined.
function codeToSubmit(): string | undefined {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();
    const generateCodeCommand:
        | string
        | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("copyToClipboardCommand");
    const sol = mainSolution(path);
    let content = "";

    if (generateCodeCommand === undefined || generateCodeCommand === "") {
        content = readFileSync(sol, "utf8");
    } else {
        const generateCodeCommands = generateCodeCommand!.split(" ");

        for (let i = 0; i < generateCodeCommands.length; i++) {
            generateCodeCommands[i] = generateCodeCommands[i].replace(
                "$CODE",
                sol
            );
        }

        const execution = runSingle(generateCodeCommands, FRIEND_TIMEOUT, "");

        if (execution.failed()) {
            vscode.window.showErrorMessage("Fail generating submission.");
            return;
        }

        content = execution.stdout().toString("utf8");
    }

    return content;
}

async function copySubmissionToClipboard() {
    const content = codeToSubmit();

    if (content !== undefined) {
        clipboardy.writeSync(content);
        vscode.window.showInformationMessage("Submission copied to clipboard!");
    }
}

export async function submitSolution() {
    const path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    const path = path_.unwrap();
    const config = ConfigFile.loadConfig(path, true).unwrap();
    const compileResult = getMainSolutionPath(path, config);

    if (compileResult.isNone()) {
        vscode.window.showErrorMessage("Could not get the code");
        return;
    }

    let mainSolutionPath = compileResult.unwrap().code;
    debug("submit-main-solution-path", `${mainSolutionPath}`);

    const url_ = config.url();

    if (url_.isNone()) {
        vscode.window.showErrorMessage("No active url");
        return;
    }

    let submitCommand: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("submitCommand");

    if (submitCommand === undefined || submitCommand === "") {
        vscode.window.showErrorMessage(
            "acmx.configuration.submitCommand not set"
        );
        return;
    }

    if (assignedCopyToClipboardCommand()) {
        const content = codeToSubmit();
        const outputFile = tmp.fileSync();
        writeSync(outputFile.fd, content);
        const nameWithExtension =
            outputFile.name + getExtension(mainSolutionPath);
        renameSync(outputFile.name, nameWithExtension);
        mainSolutionPath = nameWithExtension;
    }

    submitCommand = submitCommand
        .replace("$CODE", mainSolutionPath)
        .replace("$URL", url_.unwrap());

    debug("submit-solution-command", `${submitCommand}`);

    await vscode.window.activeTextEditor?.document.save().then(() => {
        const ter = acmxTerminal();
        ter.show();
        ter.sendText(submitCommand!);
    });
}

async function editLanguage() {
    const languages: any[] = [];

    readdirSync(globalLanguagePath())
        .filter(function (testCasePath) {
            return extname(testCasePath) === ".json";
        })
        .map(function (testCasePath) {
            const name = removeExtension(testCasePath);

            languages.push({
                label: name,
                target: testCasePath,
            });
        });

    const selectedLanguage = await vscode.window.showQuickPick(languages, {
        placeHolder: "Select language",
    });

    if (selectedLanguage !== undefined) {
        await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(join(globalLanguagePath(), selectedLanguage.target))
        );
    }
}

async function debugTest() {
    vscode.window.showInformationMessage(String.fromCharCode(65));
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    initAcmX();
    startCompetitiveCompanionService();

    const addProblemCommand = vscode.commands.registerCommand(
        "acmx.addProblem",
        addProblem
    );
    const addContestCommand = vscode.commands.registerCommand(
        "acmx.addContest",
        addContest
    );
    const runSolutionCommand = vscode.commands.registerCommand(
        "acmx.runSolution",
        runSolution
    );
    const openTestCaseCommand = vscode.commands.registerCommand(
        "acmx.openTestCase",
        openTestCase
    );
    const addTestCaseCommand = vscode.commands.registerCommand(
        "acmx.addTestCase",
        addTestCase
    );
    const codingCommand = vscode.commands.registerCommand(
        "acmx.coding",
        coding
    );
    const stressCommand = vscode.commands.registerCommand(
        "acmx.stress",
        stress
    );
    const upgradeCommand = vscode.commands.registerCommand(
        "acmx.upgrade",
        upgrade
    );
    const compileCommand = vscode.commands.registerCommand(
        "acmx.compile",
        compile
    );
    const setCheckerCommand = vscode.commands.registerCommand(
        "acmx.setChecker",
        setChecker
    );
    const selectDebugTestCaseCommand = vscode.commands.registerCommand(
        "acmx.selectDebugTestCase",
        selectDebugTestCase
    );
    const selectMainSolutionCommand = vscode.commands.registerCommand(
        "acmx.selectMainSolution",
        selectMainSolution
    );
    const selectBruteSolutionCommand = vscode.commands.registerCommand(
        "acmx.selectBruteSolution",
        selectBruteSolution
    );
    const selectGeneratorCommand = vscode.commands.registerCommand(
        "acmx.selectGenerator",
        selectGenerator
    );
    const selectCheckerCommand = vscode.commands.registerCommand(
        "acmx.selectChecker",
        selectChecker
    );
    const copySubmissionToClipboardCommand = vscode.commands.registerCommand(
        "acmx.copyToClipboard",
        copySubmissionToClipboard
    );
    const editLanguageCommand = vscode.commands.registerCommand(
        "acmx.editLanguage",
        editLanguage
    );

    const submitSolutionCommand = vscode.commands.registerCommand(
        "acmx.submitSolution",
        submitSolution
    );

    const debugTestCommand = vscode.commands.registerCommand(
        "acmx.debugTest",
        debugTest
    );

    const runTestCasesCommand = vscode.commands.registerCommand(
        "acmx.runTestCases",
        RunTestCases
    );

    context.subscriptions.push(addProblemCommand);
    context.subscriptions.push(addContestCommand);
    context.subscriptions.push(runSolutionCommand);
    context.subscriptions.push(openTestCaseCommand);
    context.subscriptions.push(addTestCaseCommand);
    context.subscriptions.push(codingCommand);
    context.subscriptions.push(stressCommand);
    context.subscriptions.push(upgradeCommand);
    context.subscriptions.push(compileCommand);
    context.subscriptions.push(setCheckerCommand);
    context.subscriptions.push(selectDebugTestCaseCommand);
    context.subscriptions.push(selectMainSolutionCommand);
    context.subscriptions.push(selectBruteSolutionCommand);
    context.subscriptions.push(selectGeneratorCommand);
    context.subscriptions.push(selectCheckerCommand);
    context.subscriptions.push(copySubmissionToClipboardCommand);
    context.subscriptions.push(editLanguageCommand);
    context.subscriptions.push(submitSolutionCommand);
    context.subscriptions.push(debugTestCommand);
    context.subscriptions.push(runTestCasesCommand);

    judgeViewProvider = new JudgeViewProvider(context.extensionUri);

    const webviewView = vscode.window.registerWebviewViewProvider(
        JudgeViewProvider.viewType,
        judgeViewProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: getRetainWebviewContextPref(),
            },
        }
    );

    context.subscriptions.push(webviewView);

    checkLaunchWebview();

    vscode.workspace.onDidCloseTextDocument((e) => {
        editorClosed(e);
    });

    vscode.window.onDidChangeActiveTextEditor((e) => {
        editorChanged(e);
    });

    vscode.window.onDidChangeVisibleTextEditors((editors) => {
        if (editors.length === 0) {
            getJudgeViewProvider().extensionToJudgeViewMessage({
                command: "new-problem",
                problem: undefined,
            });
        }
    });
}
