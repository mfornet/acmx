"use strict";
import * as child_process from "child_process";
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
    ATTIC,
    compileCode,
    currentProblem,
    initAcmX,
    newContestFromId,
    newProblemFromId,
    pathToStatic,
    removeExtension,
    solFile,
    stressSolution,
    testSolution,
    upgradeArena,
    verdictName,
} from "./core";
import { hideTerminals } from "./terminal";
import { SiteDescription, Verdict } from "./types";
import clipboardy = require("clipboardy");

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

    let path: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("solutionPath");
    path = join(path!, site.name, "single");

    let problemPath = await newProblemFromId(path, site, id);

    await vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(problemPath)
    );
    // TODO(#42): Just want to run two commands below
    // await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(solFile()));
    // vscode.window.showInformationMessage(`Add problem ${site}/${id} at ${path}`);
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
    let path: string | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("solutionPath");

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
            { groups: [{}, {}], size: 0.5 },
        ],
    });
    let sol = join(path, solFile());
    let inp = join(path, TESTCASES, `${tcId}.in`);
    let out = join(path, TESTCASES, `${tcId}.out`);
    let cur = join(path, TESTCASES, `${tcId}.real`);

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
            "vscode.diff",
            vscode.Uri.file(cur),
            vscode.Uri.file(out),
            "Difference in outputs",
            { viewColumn: vscode.ViewColumn.Three }
        );
    } else {
        await vscode.commands.executeCommand(
            "vscode.diff",
            vscode.Uri.file(out),
            "Difference in outputs",
            { viewColumn: vscode.ViewColumn.Three }
        );
    }
}

async function runSolution() {
    let path = currentProblem();

    vscode.window.activeTextEditor?.document.save().then(() => {
        if (path === undefined) {
            vscode.window.showErrorMessage("No active problem");
            return;
        }

        let result = testSolution(path);

        if (result.status === Verdict.OK) {
            vscode.window.showInformationMessage(
                `OK. Time ${result.maxTime!}ms`
            );
        } else if (result.status === Verdict.NO_TESTCASES) {
            vscode.window.showErrorMessage(`No testcases.`);
        } else {
            vscode.window.showErrorMessage(
                `${verdictName(result.status)} on test ${result.failTcId}`
            );
            debugTestCase(path, result.failTcId!);
        }
    });
}

async function compile() {
    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let sol = join(path, solFile());
    let out = join(path, ATTIC, "sol");

    if (!existsSync(sol)) {
        vscode.window.showErrorMessage("Open a coding environment first.");
        return;
    }

    vscode.window.activeTextEditor?.document.save().then(() => {
        // Compile solution
        let result = compileCode(sol, out);

        if (result.status !== 0) {
            vscode.window.showErrorMessage(`Compilation Error. ${sol}`);
            let error_path = join(path!, "stderr");
            let error_file = openSync(error_path, "w");
            writeSync(error_file, result.stderr.toString());
            vscode.commands.executeCommand("vscode.setEditorLayout", {
                orientation: 1,
                groups: [{ groups: [{}, {}], size: 0.5 }],
            });
            vscode.commands.executeCommand(
                "vscode.open",
                vscode.Uri.file(error_path),
                vscode.ViewColumn.Two
            );
        } else {
            vscode.window.showInformationMessage("Compilation successfully.");
        }
    });
}

async function openTestCase() {
    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let tcs: any[] = [];

    // Read testcases
    readdirSync(join(path, TESTCASES))
        .filter(function (tc_path) {
            return extname(tc_path) === ".in";
        })
        .map(function (tc_path) {
            let name = removeExtension(tc_path);

            tcs.push({
                label: name,
                target: name,
            });
        });

    let tc = await vscode.window.showQuickPick(tcs, {
        placeHolder: "Select test case",
    });

    if (tc !== undefined) {
        let inp = join(path, TESTCASES, `${tc.target}.in`);
        let out = join(path, TESTCASES, `${tc.target}.out`);

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
    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let index = 0;
    while (existsSync(join(path, TESTCASES, `${index}.hand.in`))) {
        index += 1;
    }

    let inp = join(path, TESTCASES, `${index}.hand.in`);
    let out = join(path, TESTCASES, `${index}.hand.out`);

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
    hideTerminals();

    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    await vscode.commands.executeCommand("vscode.setEditorLayout", {
        groups: [{}],
    });

    let sol = join(path, solFile());

    await vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.file(sol),
        vscode.ViewColumn.One
    );
}

async function stress() {
    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let stressTimes: number | undefined = vscode.workspace
        .getConfiguration("acmx.stress", null)
        .get("times");

    // Use default
    if (stressTimes === undefined) {
        stressTimes = 10;
    }

    let result = stressSolution(path, stressTimes);

    if (result.status === Verdict.OK) {
        vscode.window.showInformationMessage(`OK. Time ${result.maxTime!}ms`);
    } else {
        vscode.window.showErrorMessage(
            `${verdictName(result.status)} on test ${result.failTcId}`
        );
        debugTestCase(path, result.failTcId!);
    }
}

async function upgrade() {
    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    upgradeArena(path);
}

function fileList(dir: string): string[] {
    return readdirSync(dir).reduce((list: string[], file: string) => {
        return list.concat([file]);
    }, []);
}

async function setChecker() {
    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let all_checkers_plain = fileList(join(pathToStatic(), "checkers"))
        .filter((name: string) => name !== "testlib.h")
        .map((name: string) => name.slice(0, name.length - 4));

    let all_checkers = all_checkers_plain.map((value: string) => {
        return {
            label: value,
            target: value + ".cpp",
        };
    });

    let checker_info = await vscode.window.showQuickPick(all_checkers, {
        placeHolder: "Select custom checker.",
    });

    if (checker_info === undefined) {
        vscode.window.showErrorMessage("Checker not provided.");
        return;
    }

    let checker = checker_info.target;

    let checker_path = join(pathToStatic(), "checkers", checker);
    let checker_dest = join(path, ATTIC, "checker.cpp");

    copyFileSync(checker_path, checker_dest);
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
    let path = currentProblem();

    if (path === undefined) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let submissionCommand:
        | string
        | undefined = vscode.workspace
        .getConfiguration("acmx.configuration", null)
        .get("copyToClipboardCommand");
    let sol = join(path, solFile());
    let content = "";

    if (submissionCommand === undefined || submissionCommand === "") {
        content = readFileSync(sol, "utf8");
    } else {
        let submissionCommands = submissionCommand!.split(" ");

        for (let i = 0; i < submissionCommands.length; i++) {
            submissionCommands[i] = submissionCommands[i].replace(
                "$PROGRAM",
                sol
            );
        }

        let result = child_process.spawnSync(
            submissionCommands[0],
            submissionCommands.slice(1)
        );

        if (result.status !== 0) {
            vscode.window.showErrorMessage("Fail generating submission.");
            return;
        }

        content = result.stdout.toString();
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
