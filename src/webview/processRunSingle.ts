import * as vscode from 'vscode';
import { getJudgeViewProvider } from '../extension';
import { saveProblem } from './core';
import { Problem, RunResult, Run } from './types';
import { currentProblem, getMainSolutionPath, getCheckerPath, getTimeout, timedRun } from '../core';
import { ConfigFile, TESTCASES, Verdict } from '../primitives';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

export const runSingleAndSave = async (
    problem: Problem,
    id: number,
) : Promise<boolean> => {
    console.log('Run and save started', problem, id);

    const srcPath = problem.srcPath;

    const textEditor = await vscode.workspace.openTextDocument(srcPath);
    await vscode.window.showTextDocument(textEditor, vscode.ViewColumn.One);
    await textEditor.save();

    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem (oops)");
        return false;
    }

    let path = path_.unwrap();

    let config = ConfigFile.loadConfig(path, true).unwrap();

    // Load main solution (compile if necessary)
    let mainSolution_ = getMainSolutionPath(path, config);
    if (mainSolution_.isNone()) {
        vscode.window.showErrorMessage("Main solution not found (oops)");
        return false;
    }
    let mainSolution = mainSolution_.unwrap();

    // Load checker (compile if necessary)
    let checker_ = getCheckerPath(path, config);
    if (checker_.isNone()) {
        vscode.window.showErrorMessage("Checker not found (oops)");
        return false;
    }
    let checker = checker_.unwrap();

    // Try to find time limit from local config first, otherwise use global time limit.
    // TODO: Add to wiki about this feature, and how to change custom time limit.
    let timeout = config.timeLimit().unwrapOr(getTimeout());

    let tcName = id.toString();
    let tcInputPath = join(path, TESTCASES, `${tcName}.in`);

    if (!existsSync(tcInputPath)) {
        console.error('Invalid id', id, problem);
        return false;
    }

    let tcResult = timedRun(path, tcName, timeout, mainSolution, checker); 
    
    if (tcResult.status === Verdict.CE) {
        console.error('Failed to compile', problem, id);
        return false;
    }

    saveProblem(srcPath, problem); // ??

    const run: Run =  {
        stdout: readFileSync(join(path, TESTCASES, `${tcName}.out`, "utf8")).toString(),
        stderr: '',
        code: 0,
        signal: null,
        time: tcResult.spanTime ?? 0,
        timeOut: tcResult.status === Verdict.TLE,
    };

    const result: RunResult = {
        ...run,
        pass: tcResult.status === Verdict.OK,
        id,
    };

    console.log('Testcase judging complete. Result:', result);
    getJudgeViewProvider().extensionToJudgeViewMessage({
        command: 'run-single-result',
        result,
        problem,
    });

    return true;
};
