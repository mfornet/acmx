import { RunResult } from './types';
import {
    currentProblem,
    getMainSolutionPath,
    getCheckerPath,
    getTimeout,
    timedRun
} from '../core';
import * as vscode from 'vscode';
import { getJudgeViewProvider } from '../extension';

import { ConfigFile } from '../primitives';

export const runSingleAndSave = async (
    tcName: string
) => {
    console.log('Run and save started', tcName);

    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    await vscode.window.activeTextEditor?.document.save();

    let path = path_.unwrap();

    let config = ConfigFile.loadConfig(path, true).unwrap();

    // Load main solution (compile if necessary)
    let mainSolution_ = getMainSolutionPath(path, config);
    if (mainSolution_.isNone()) {
        vscode.window.showErrorMessage("Main solution not found (oops)");
        return;
    }
    let mainSolution = mainSolution_.unwrap();

    // Load checker (compile if necessary)
    let checker_ = getCheckerPath(path, config);
    if (checker_.isNone()) {
        vscode.window.showErrorMessage("Checker not found");
        return;
    }
    let checker = checker_.unwrap();

    // Try to find time limit from local config first, otherwise use global time limit.
    // TODO: Add to wiki about this feature, and how to change custom time limit.
    let timeout = config.timeLimit().unwrapOr(getTimeout());

    let tcResult = timedRun(path, tcName, timeout, mainSolution, checker);    

    const result: RunResult = {
        tcResult,
        tcName,
    };

    console.log('Testcase judging complete. Result:', result);
    getJudgeViewProvider().extensionToJudgeViewMessage({
        command: 'run-single-result',
        result,
    });
};
