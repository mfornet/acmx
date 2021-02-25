import * as vscode from 'vscode';
import { Problem, TestCase } from './types';
import { isProblemFolder, testCasesName } from '../core';
import { dirname, join } from 'path';
import { ConfigFile, TESTCASES } from '../primitives';
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { submitSolution, addProblem, getJudgeViewProvider } from '../extension';
import { recursiveRemoveDirectory } from '../test/testUtils';
import { removeExtension } from '../utils';
import runAllAndSave from './processRunAll';

let onlineJudgeEnv = false;

export const setOnlineJudgeEnv = (value: boolean) => {
    onlineJudgeEnv = value;
    console.log('online judge env:', onlineJudgeEnv);
};

export const getProblemForDocument = (
    document: vscode.TextDocument | undefined,
): Problem | undefined => {
    if (document === undefined) {
        return undefined;
    }

    // Try to find the problem using current open file
    let path = document.uri.fsPath;

    const MAX_DEPTH = 1;

    for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
        path = dirname(path);
    }

    if (!isProblemFolder(path)) {
        return undefined;
    }

    let config = ConfigFile.loadConfig(path, true).unwrap();
    
    let companionConfig = null;
    if (config.companionConfig.isSome())
        companionConfig = config.companionConfig.unwrap();

    let testcasesname = testCasesName(path);
    let testcases : TestCase[] = [];
    testcases.sort();
    testcasesname.forEach((id) => {
        const c: TestCase = {
            input: readFileSync(join(path, TESTCASES, `${id}.in`), "utf8"),
            output: readFileSync(join(path, TESTCASES, `${id}.ans`), "utf8"),
            id: parseInt(id),
        }
        testcases.push(c);
    });
    
    const problem: Problem = {
        name: companionConfig?.name ?? '',
        url: companionConfig?.url ?? '',
        interactive: false,
        memoryLimit: companionConfig?.memoryLimit ?? 0,
        timeLimit: companionConfig?.timeLimit ?? 0,
        group: companionConfig?.group ?? '',
        tests: testcases,
        srcPath: config.mainSolution.unwrapOr(''),
        local: false,
    }

    return problem;
};

export const saveProblem = (srcPath: string, problem: Problem) => {
    let path = srcPath;
    const MAX_DEPTH = 3;

    for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
        path = dirname(path);
    }
    
    if (!isProblemFolder(path)) {
        console.error('Invalid save path', srcPath, problem);
        return;
    }

    path = join(path, TESTCASES);
    
    problem.tests.forEach((test) => {
        writeFileSync(join(path, `${test.id}.in`), test.input);
        writeFileSync(join(path, `${test.id}.ans`), test.output);
    });
};

export const deleteProblemFile = (srcPath: string) => {
    let path = srcPath;
    const MAX_DEPTH = 3;

    for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
        path = dirname(path);
    }
    
    if (!isProblemFolder(path)) {
        console.error('Invalid delete path', srcPath);
        return;
    }

    recursiveRemoveDirectory(path);
};

export const deleteProblemCase = (srcPath: string, id: number) => {
    let path = srcPath;
    const MAX_DEPTH = 3;

    for (let i = 0; i < MAX_DEPTH && !isProblemFolder(path); i++) {
        path = dirname(path);
    }
    
    if (!isProblemFolder(path)) {
        console.error('Invalid delete path', srcPath);
        return;
    }

    path = join(path, TESTCASES);
    readdirSync(path).filter(file =>
        (removeExtension(file)) === id.toString())
            .forEach(file => {
                unlinkSync(join(path, file));
    });
};

export const SubmitProblem = (problem: Problem) => {
    console.log('submitted ' + problem.srcPath);
    submitSolution();
};

export const AddProblem = () => {    
    addProblem();
};

export async function RunTestCases() {
    console.log('Running command "runTestCases"');
    const editor = vscode.window.activeTextEditor;
    
    if (!editor){
        return;
    }

    let problem = getProblemForDocument(editor.document);
    if (!problem) {
        return;
    }

    await editor.document.save();
    getJudgeViewProvider().focus();
    getJudgeViewProvider().extensionToJudgeViewMessage({
        command: 'new-problem',
        problem: problem,
    });
    runAllAndSave(problem);
    vscode.window.showTextDocument(editor.document, vscode.ViewColumn.One);
};
