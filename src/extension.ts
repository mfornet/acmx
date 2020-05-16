"use strict";
import {
    closeSync,
    copyFileSync,
    existsSync,
    openSync,
    readdirSync,
    readFileSync,
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
} from "./core";
import {
    SiteDescription,
    Verdict,
    ATTIC,
    FRIEND_TIMEOUT,
    verdictName,
} from "./primitives";
import * as clipboardy from "clipboardy";
import { debug, removeExtension } from "./utils";
import { preRun, runSingle } from "./runner";

const TESTCASES = "testcases";

// Create a new problem
async function addProblem() {
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

    // TODO(#42): Run two commands below
    // await vscode.commands.executeCommand(
    //     "vscode.open",
    //     vscode.Uri.file(mainSolution(problemPath))
    // );
    // vscode.window.showInformationMessage(
    //     `Add problem ${site}/${id} at ${path}`
    // );
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
            { groups: [{}, [{}, {}]], size: 0.5 },
        ],
    });
    let sol = mainSolution(path);
    let inp = join(path, TESTCASES, `${tcId}.in`);
    let out = join(path, TESTCASES, `${tcId}.ans`);
    let cur = join(path, TESTCASES, `${tcId}.out`);

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
    if (existsSync(cur)) {
        await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(cur),
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
            vscode.Uri.file(out),
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
            vscode.window.showInformationMessage("Compilation successful.");
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

    let stressTimes: number | undefined = vscode.workspace
        .getConfiguration("acmx.stress", null)
        .get("times");

    // Use default
    if (stressTimes === undefined) {
        stressTimes = 10;
    }

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

    let allCheckersPlain = fileList(join(pathToStatic(), "checkers"))
        .filter((name: string) => name !== "testlib.h")
        .map((name: string) => name.slice(0, name.length - 4));

    let allChecker = allCheckersPlain.map((value: string) => {
        return {
            label: value,
            target: value + ".cpp",
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

async function copySubmissionToClipboard() {
    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let path = path_.unwrap();
    let submissionCommand:
        | string
        | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("copyToClipboardCommand");
    let sol = mainSolution(path);
    let content = "";

    if (submissionCommand === undefined || submissionCommand === "") {
        content = readFileSync(sol, "utf8");
    } else {
        let submissionCommands = submissionCommand!.split(" ");

        for (let i = 0; i < submissionCommands.length; i++) {
            submissionCommands[i] = submissionCommands[i].replace("$CODE", sol);
        }

        let execution = runSingle(submissionCommands, FRIEND_TIMEOUT, "");

        if (execution.failed()) {
            vscode.window.showErrorMessage("Fail generating submission.");
            return;
        }

        content = execution.stdout().toString("utf8");
    }

    clipboardy.writeSync(content);
    vscode.window.showInformationMessage("Submission copied to clipboard!");
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
    let copySubmissionToClipboardCommand = vscode.commands.registerCommand(
        "acmx.copyToClipboard",
        copySubmissionToClipboard
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
    context.subscriptions.push(copySubmissionToClipboardCommand);

    context.subscriptions.push(debugTestCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {}
