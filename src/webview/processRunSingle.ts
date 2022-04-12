import * as vscode from "vscode";
import { getJudgeViewProvider } from "../extension";
import { Problem, RunResult, Run } from "./types";
import {
    isProblemFolder,
    getMainSolutionPath,
    getCheckerPath,
    getTimeout,
    timedRun,
} from "../core";
import { ConfigFile, TESTCASES, Verdict, verdictName } from "../primitives";
import { join, dirname } from "path";
import { existsSync } from "fs";

export const emit_fail = (problem: Problem, id: number): void => {
    const run: Run = {
        stdout: "",
        stderr: "",
        code: 0,
        signal: null,
        time: 0,
        timeOut: false,
    };

    const result: RunResult = {
        ...run,
        pass: false,
        id: id,
        verdictname: verdictName(Verdict.FAIL),
    };

    console.log("Testcase judging complete. Result:", result);
    getJudgeViewProvider().extensionToJudgeViewMessage({
        command: "run-single-result",
        result,
        problem,
    });
};

export const runSingleAndSave = async (
    problem: Problem,
    id: number
): Promise<boolean> => {
    console.log("Run and save started", problem, id);

    const srcPath = problem.srcPath;

    const textEditor = await vscode.workspace.openTextDocument(srcPath);
    await vscode.window.showTextDocument(textEditor, vscode.ViewColumn.One);
    await textEditor.save();

    let path = srcPath;

    const MAX_DEPTH = 3;

    for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
        path = dirname(path);
    }

    if (!isProblemFolder(path)) {
        vscode.window.showErrorMessage("No active problem");
        emit_fail(problem, id);
        return false;
    }

    const config = ConfigFile.loadConfig(path, true).unwrap();

    // Load main solution (compile if necessary)
    const mainSolution_ = getMainSolutionPath(path, config);
    if (mainSolution_.isNone()) {
        emit_fail(problem, id);
        return false;
    }
    const mainSolution = mainSolution_.unwrap();

    // Load checker (compile if necessary)
    const checker_ = getCheckerPath(path, config);
    if (checker_.isNone()) {
        vscode.window.showErrorMessage("Checker not found");
        emit_fail(problem, id);
        return false;
    }
    const checker = checker_.unwrap();

    // Try to find time limit from local config first, otherwise use global time limit.
    // TODO: Add to wiki about this feature, and how to change custom time limit.
    const timeout = config.timeLimit().unwrapOr(getTimeout());

    const tcName = id.toString();
    const tcInputPath = join(path, TESTCASES, `${tcName}.in`);

    if (!existsSync(tcInputPath)) {
        console.error("Invalid id", id, problem);
        emit_fail(problem, id);
        return false;
    }

    const tcResult = timedRun(path, tcName, timeout, mainSolution, checker);

    const run: Run = {
        stdout: tcResult.stdout ?? "",
        stderr: tcResult.stderr ?? "",
        code: 0,
        signal: null,
        time: tcResult.spanTime ?? 0,
        timeOut: tcResult.status === Verdict.TLE,
    };

    const result: RunResult = {
        ...run,
        pass: tcResult.status === Verdict.OK,
        id: id,
        verdictname: verdictName(tcResult.status),
    };

    console.log("Testcase judging complete. Result:", result);
    getJudgeViewProvider().extensionToJudgeViewMessage({
        command: "run-single-result",
        result,
        problem,
    });

    if (tcResult.status === Verdict.CE) {
        return false;
    }
    return true;
};
