import { runSingleAndSave } from './processRunSingle';
import { getJudgeViewProvider } from '../extension';
import { testCasesName, currentProblem } from '../core';
import * as vscode from 'vscode';

/**
 * Run every testcase in a problem one by one. Waits for the first to complete
 * before running next. `runSingleAndSave` takes care of saving.
 **/
export default async () => {
    console.log('Run all started');

    let path_ = currentProblem();

    if (path_.isNone()) {
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    await vscode.window.activeTextEditor?.document.save();

    let path = path_.unwrap();

    let tests = testCasesName(path);

    for (const testCase of tests) {
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: 'running',
            tcName: testCase,
        });
        await runSingleAndSave(testCase);
    }
    console.log('Run all finished');
};
