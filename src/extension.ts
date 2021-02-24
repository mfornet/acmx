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
} from './webview/editorChange';

import { getRetainWebviewContextPref } from './webview/types'

import JudgeViewProvider from './webview/JudgeView';

let judgeViewProvider: JudgeViewProvider;

export const getJudgeViewProvider = () => {
    return judgeViewProvider;
};

const TESTCASES = "testcases";

// Create a new problem
export async function addProblem() {
    // Use default site when creating a problem from the vscode.
    let site: SiteDescription = EMPTY;

    let id = await vscode.window.showInputBox({
        placeHolder: site.problemIdPlaceholder,
    });

    if (id === undefined) {
        vscode.window.showErrorMessage("Problem ID not provided.");
        return;
    }

    let path = getSolutionPath();
    path = join(path!, site.name, "single");

    let problemPath = newProblemFromId(path, site, id);

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
        let value = numberOfProblems.charCodeAt(0);
        if (97 <= value && value <= 122) {
            return value - 97 + 1;
        }
    }

    let res = Number.parseInt(numberOfProblems);

    if (Number.isNaN(res)) {
        return undefined;
    } else {
        return res;
    }
}

async function addContest() {
    let path = getSolutionPath();
    let site: SiteDescription = EMPTY;

    let id = undefined;

    let name = await vscode.window.showInputBox({
        placeHolder: site.contestIdPlaceholder,
    });

    if (name === undefined) {
        vscode.window.showErrorMessage("Name not provided.");
        return;
    }

    let probCountStr = await vscode.window.showInputBox({
        placeHolder: "Number of problems",
    });
    let probCount = parseNumberOfProblems(probCountStr);

    if (probCount === undefined) {
        vscode.window.showErrorMessage("Number of problems not provided.");
        return;
    }

    id = name + "-" + probCount.toString();

    let contestPath = await newContestFromId(path!, site, id);

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

    let sol = mainSolution(path);
    let inp = join(path, TESTCASES, `${tcId}.in`);
    let ans = join(path, TESTCASES, `${tcId}.ans`);
    let out = join(path, TESTCASES, `${tcId}.out`);

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
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();
    debug("run-solution", `${path}`);

    await vscode.window.activeTextEditor?.document.save().then(() => {
        let result_ = testSolution(path);

        if (result_.isNone()) {
            return;
        }

        let result = result_.unwrap();

        if (result.isOk()) {
            vscode.window.showInformationMessage(
                `OK. Time ${result.getMaxTime()}ms`
            );
        } else if (result.status === Verdict.NO_TESTCASES) {
            vscode.window.showErrorMessage(`No testcases.`);
        } else {
            let failTestCaseId = result.getFailTestCaseId();
            vscode.window.showErrorMessage(
                `${verdictName(result.status)} on test ${failTestCaseId}`
            );
            debugTestCase(path, failTestCaseId);
        }
    });
}

async function compile() {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    debug("compile", `${path}`);

    let sol = mainSolution(path);
    let out = join(path, ATTIC, "sol");

    if (!existsSync(sol)) {
        vscode.window.showErrorMessage("Open a coding environment first.");
        return;
    }

    await vscode.window.activeTextEditor?.document.save().then(() => {
        // Compile solution
        let result = preRun(sol, out, path!, FRIEND_TIMEOUT);

        if (result.isNone()) {
            vscode.window.showInformationMessage("No compilation needed.");
        } else if (!result.unwrap().failed()) {
            let message = "";
            if (result.unwrap().getCached()) {
                message = " (cached)";
            } else if (result.unwrap().stderr().length > 0) {
                message = " with warnings";
            }
            vscode.window.showInformationMessage("Compilation successful" + message + ".");
        }
    });
}

async function openTestCase() {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();
    let testCases: any[] = [];

    // Read testcases
    readdirSync(join(path, TESTCASES))
        .filter(function (testCasePath) {
            return extname(testCasePath) === ".in";
        })
        .map(function (testCasePath) {
            let name = removeExtension(testCasePath);

            testCases.push({
                label: name,
                target: name,
            });
        });

    let tc = await vscode.window.showQuickPick(testCases, {
        placeHolder: "Select test case",
    });

    if (tc !== undefined) {
        let inp = join(path, TESTCASES, `${tc.target}.in`);
        let out = join(path, TESTCASES, `${tc.target}.ans`);

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
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    let index = 0;
    while (existsSync(join(path, TESTCASES, `${index}.hand.in`))) {
        index += 1;
    }

    let inp = join(path, TESTCASES, `${index}.hand.in`);
    let out = join(path, TESTCASES, `${index}.hand.ans`);

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

    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    await vscode.commands.executeCommand("vscode.setEditorLayout", {
        groups: [{}],
    });

    let sol = mainSolution(path);

    await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(sol),
        vscode.ViewColumn.One
    );
}

async function stress() {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    let _stressTimes: number | undefined = vscode.workspace
        .getConfiguration("acmx.stress", null)
        .get("times");

    // Default stress times is 10
    let stressTimes = 10;

    if (_stressTimes !== undefined) {
        stressTimes = _stressTimes;
    }

    await vscode.window.activeTextEditor?.document.save().then(() => {
        let result_ = stressSolution(path, stressTimes);

        if (result_.isNone()) {
            return;
        }

        let result = result_.unwrap();

        if (result.isOk()) {
            vscode.window.showInformationMessage(
                `OK. Time ${result.getMaxTime()}ms`
            );
        } else {
            let failTestCaseId = result.getFailTestCaseId();
            vscode.window.showErrorMessage(
                `${verdictName(result.status)} on test ${failTestCaseId}`
            );
            debugTestCase(path, failTestCaseId);
        }
    });
}

async function upgrade() {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    upgradeArena(path);
}

function fileList(dir: string): string[] {
    return readdirSync(dir).reduce((list: string[], file: string) => {
        return list.concat([file]);
    }, []);
}

async function setChecker() {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    let allCheckersPlain = fileList(join(pathToStatic(), "checkers")).filter(
        (name: string) => name !== "testlib.h"
    );
    let allChecker = allCheckersPlain.map((value: string) => {
        var data = readFileSync(
            join(pathToStatic(), "checkers", value),
            "utf8"
        );
        var regex = /setName\("(.*?)"\)/;
        var matched = regex.exec(data)![1];
        return {
            label: value.slice(0, value.length - 4),
            detail: matched,
            target: value,
        };
    });

    let checkerInfo = await vscode.window.showQuickPick(allChecker, {
        placeHolder: "Select custom checker.",
    });

    if (checkerInfo === undefined) {
        vscode.window.showErrorMessage("Checker not provided.");
        return;
    }

    let checker = checkerInfo.target;

    let checkerPath = join(pathToStatic(), "checkers", checker);
    let checkerDest = join(path, ATTIC, "checker.cpp");

    copyFileSync(checkerPath, checkerDest);
    let config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.checker = Option.some(checkerDest);
    config.dump(path);
}

async function selectDebugTestCase(uriPath: vscode.Uri) {
    let testCaseName = basename(uriPath.path);
    let path = dirname(uriPath.path);

    const MAX_DEPTH = 2;

    for (let i = 0; i < MAX_DEPTH && !existsSync(join(path, ".vscode")); i++) {
        path = dirname(path);
    }

    let launchTaskPath = join(path, ".vscode", "launch.json");

    if (!existsSync(launchTaskPath)) {
        return undefined;
    }

    let launchTaskData = readFileSync(launchTaskPath, "utf8");
    // TODO(#20): Don't use regular expression to replace this. Use JSON parser instead.
    let newTaskData = launchTaskData.replace(
        /\"stdio\"\:.+/,
        `"stdio": ["\${fileDirname}/testcases/${testCaseName}"],`
    );
    let launchTaskFdW = openSync(launchTaskPath, "w");
    writeSync(launchTaskFdW, newTaskData);
    closeSync(launchTaskFdW);
}

async function selectMainSolution(uriPath: vscode.Uri) {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    let config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.mainSolution = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

async function selectBruteSolution(uriPath: vscode.Uri) {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    let config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.bruteSolution = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

async function selectGenerator(uriPath: vscode.Uri) {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    let config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.generator = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

async function selectChecker(uriPath: vscode.Uri) {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();

    let config = ConfigFile.loadConfig(path).unwrapOr(ConfigFile.empty());
    config.checker = Option.some(uriPath.path);
    config.dump(path);
    console.log(uriPath);
}

function assignedCopyToClipboardCommand(): Boolean {
    let generateCodeCommand:
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
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();
    let generateCodeCommand:
        | string
        | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("copyToClipboardCommand");
    let sol = mainSolution(path);
    let content = "";

    if (generateCodeCommand === undefined || generateCodeCommand === "") {
        content = readFileSync(sol, "utf8");
    } else {
        let generateCodeCommands = generateCodeCommand!.split(" ");

        for (let i = 0; i < generateCodeCommands.length; i++) {
            generateCodeCommands[i] = generateCodeCommands[i].replace(
                "$CODE",
                sol
            );
        }

        let execution = runSingle(generateCodeCommands, FRIEND_TIMEOUT, "");

        if (execution.failed()) {
            vscode.window.showErrorMessage("Fail generating submission.");
            return;
        }

        content = execution.stdout().toString("utf8");
    }

    return content;
}

async function copySubmissionToClipboard() {
    let content = codeToSubmit();

    if (content !== undefined) {
        clipboardy.writeSync(content);
        vscode.window.showInformationMessage("Submission copied to clipboard!");
    }
}

export async function submitSolution() {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();
    let config = ConfigFile.loadConfig(path, true).unwrap();
    let compileResult = getMainSolutionPath(path, config);

    if (compileResult.isNone()) {
        vscode.window.showErrorMessage("Could not get the code");
        return;
    }

    let mainSolutionPath = compileResult.unwrap().code;
    debug("submit-main-solution-path", `${mainSolutionPath}`);

    let url_ = config.url();

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
        let content = codeToSubmit();
        let outputFile = tmp.fileSync();
        writeSync(outputFile.fd, content);
        let nameWithExtension =
            outputFile.name + getExtension(mainSolutionPath);
        renameSync(outputFile.name, nameWithExtension);
        mainSolutionPath = nameWithExtension;
    }

    submitCommand = submitCommand
        .replace("$CODE", mainSolutionPath)
        .replace("$URL", url_.unwrap());

    debug("submit-solution-command", `${submitCommand}`);

    await vscode.window.activeTextEditor?.document.save().then(() => {
        let ter = acmxTerminal();
        ter.show();
        ter.sendText(submitCommand!);
    });
}

async function editLanguage() {
    let languages: any[] = [];

    readdirSync(globalLanguagePath())
        .filter(function (testCasePath) {
            return extname(testCasePath) === ".json";
        })
        .map(function (testCasePath) {
            let name = removeExtension(testCasePath);

            languages.push({
                label: name,
                target: testCasePath,
            });
        });

    let selectedLanguage = await vscode.window.showQuickPick(languages, {
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

    let addProblemCommand = vscode.commands.registerCommand(
        "acmx.addProblem",
        addProblem
    );
    let addContestCommand = vscode.commands.registerCommand(
        "acmx.addContest",
        addContest
    );
    let runSolutionCommand = vscode.commands.registerCommand(
        "acmx.runSolution",
        runSolution
    );
    let openTestCaseCommand = vscode.commands.registerCommand(
        "acmx.openTestCase",
        openTestCase
    );
    let addTestCaseCommand = vscode.commands.registerCommand(
        "acmx.addTestCase",
        addTestCase
    );
    let codingCommand = vscode.commands.registerCommand("acmx.coding", coding);
    let stressCommand = vscode.commands.registerCommand("acmx.stress", stress);
    let upgradeCommand = vscode.commands.registerCommand(
        "acmx.upgrade",
        upgrade
    );
    let compileCommand = vscode.commands.registerCommand(
        "acmx.compile",
        compile
    );
    let setCheckerCommand = vscode.commands.registerCommand(
        "acmx.setChecker",
        setChecker
    );
    let selectDebugTestCaseCommand = vscode.commands.registerCommand(
        "acmx.selectDebugTestCase",
        selectDebugTestCase
    );
    let selectMainSolutionCommand = vscode.commands.registerCommand(
        "acmx.selectMainSolution",
        selectMainSolution
    );
    let selectBruteSolutionCommand = vscode.commands.registerCommand(
        "acmx.selectBruteSolution",
        selectBruteSolution
    );
    let selectGeneratorCommand = vscode.commands.registerCommand(
        "acmx.selectGenerator",
        selectGenerator
    );
    let selectCheckerCommand = vscode.commands.registerCommand(
        "acmx.selectChecker",
        selectChecker
    );
    let copySubmissionToClipboardCommand = vscode.commands.registerCommand(
        "acmx.copyToClipboard",
        copySubmissionToClipboard
    );
    let editLanguageCommand = vscode.commands.registerCommand(
        "acmx.editLanguage",
        editLanguage
    );

    let submitSolutionCommand = vscode.commands.registerCommand(
        "acmx.submitSolution",
        submitSolution
    );

    let debugTestCommand = vscode.commands.registerCommand(
        "acmx.debugTest",
        debugTest
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

    judgeViewProvider = new JudgeViewProvider(context.extensionUri);

    const webviewView = vscode.window.registerWebviewViewProvider(
        JudgeViewProvider.viewType,
        judgeViewProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: getRetainWebviewContextPref(),
            },
        },
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
                command: 'new-problem',
                problem: undefined,
            });
        }
    });
}

// this method is called when your extension is deactivated
export function deactivate() {}
