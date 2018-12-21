'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as xpath from 'path';
import { exec } from 'child_process';
import { existsSync, writeFileSync } from 'fs';

// TODO: Add several checkers and try to infer which is the correct! MACHINE LEARNING
// TODO: Implement parser for codeforces to test on real cases
// TODO: Smart ID detection while parsing ContestId & ProblemId (More Machine Learning :)
// TODO: Move acmh to typescript. How to measure time in typescript???
// TODO: Find great name/slogan!!! Competitive Programming made simple

const SITES = [
    { label: 'Codeforces', target: 'codeforces' },
    // TODO: Disable this for real application
    { label: 'Mock', description: 'Fake site for experimentation', target: 'mock' },
];

const TESTCASES = 'testcases';
const ATTIC = 'attic';

function is_problem_folder(path: string) {
    return  existsSync(xpath.join(path, 'sol.cpp')) &&
            existsSync(xpath.join(path, 'attic'));
}

function current_problem() {
    if (vscode.window.activeTextEditor){
        let path = vscode.window.activeTextEditor.document.uri.path;

        const MAX_DEPTH = 3;

        for (let i = 0; i < MAX_DEPTH && !is_problem_folder(path); i++) {
            path = xpath.dirname(path);
        }

        if (is_problem_folder(path)){
            return path;
        }
    }

    if (vscode.workspace.workspaceFolders !== undefined){
        let path = vscode.workspace.workspaceFolders[0].uri.path;

        const MAX_DEPTH = 1;

        for (let i = 0; i < MAX_DEPTH && !is_problem_folder(path); i++) {
            path = xpath.dirname(path);
        }

        if (is_problem_folder(path)){
            return path;
        }
    }

    return undefined;
}

// Create a new problem
async function add_problem() {
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage("Open the folder that will contain the problem.");
        return;
    }

    let path = vscode.workspace.workspaceFolders[0].uri.path;

    let site_info = await vscode.window.showQuickPick(SITES, { placeHolder: 'Select contest site' });

    if (site_info === undefined){
        vscode.window.showErrorMessage("Site not provided.");
        return;
    }

    let site = site_info.target;

    // TODO: Provide custom problem id example in placeholder per different site
    let id = await vscode.window.showInputBox({placeHolder: "Problem ID"});

    if (id === undefined){
        vscode.window.showErrorMessage("Problem ID not provided.");
        return;
    }

    path = xpath.join(path, `${id}`);

    let command = `acmh problem ${site} ${id} -p ${path}`;

    await exec(command, async function(error, stdout, stderr) {
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path));
        // TODO: How can I have access to new proccess created using `openFolder`?
        // Just want to run two commands below
        // await vscode.commands.executeCommand("vscode.open", vscode.Uri.file("sol.cpp"));
        // vscode.window.showInformationMessage(`Add problem ${site}/${id} at ${path}`);
    });
}

async function add_contest() {
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage("Open the folder that will contain the contest.");
        return;
    }

    let path = vscode.workspace.workspaceFolders[0].uri.path;

    let site_info = await vscode.window.showQuickPick(SITES, { placeHolder: 'Select contest site' });

    if (site_info === undefined){
        vscode.window.showErrorMessage("Site not provided.");
        return;
    }

    let site = site_info.target;

    // TODO: Provide custom contest id example in placeholder per different site
    let id = await vscode.window.showInputBox({placeHolder: "Contest ID"});

    if (id === undefined){
        vscode.window.showErrorMessage("Contest ID not provided.");
        return;
    }

    path = xpath.join(path, `${id}`);

    let command = `acmh contest ${site} ${id} -p ${path}`;

    await exec(command, async function(error, stdout, stderr) {
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path));
    });
}

async function run_solution(){
    let path = current_problem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let command = `acmh run -p ${path}`;

    await exec(command, async function(error, stdout, stderr) {
        let lines = stdout.split('\n');

        if (lines[0] === 'ok'){
            vscode.window.showInformationMessage("OK!");
        }
        else{
            vscode.window.showErrorMessage(`${lines[0]} on test ${lines[1]}`);
            await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{ groups: [{}], size: 0.5 }, { groups: [{}, {}, {}], size: 0.5 }] });

            // This is always true
            if (path !== undefined){
                let testid = lines[1];
                let sol = xpath.join(path, `sol.cpp`);
                let inp = xpath.join(path, TESTCASES, `${testid}.in`);
                let out = xpath.join(path, TESTCASES, `${testid}.out`);
                let cur = xpath.join(path, TESTCASES, `${testid}.cur`);

                // TODO: How to clear opened tabs?
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(sol), vscode.ViewColumn.One);
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(inp), vscode.ViewColumn.Two);
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(out), vscode.ViewColumn.Three);

                // This file might not exist!
                if (existsSync(cur)){
                    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(cur), vscode.ViewColumn.Four);
                }
            }
        }
    });
}

async function open_testcase() {
    let path = current_problem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let tcs = [];

    // TODO: How to listdir in typescript?
    let num = 0;
    while (existsSync(xpath.join(path, TESTCASES, `${num}.in`))){
        tcs.push({
            'label' : `${num}`,
            'target' : `${num}`
        });

        num += 1
    }

    let tc = await vscode.window.showQuickPick(tcs, { placeHolder: 'Select testcase' });

    if (tc !== undefined){
        let inp = xpath.join(path, TESTCASES, `${tc.target}.in`);
        let out = xpath.join(path, TESTCASES, `${tc.target}.out`);

        await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{}, {}]});
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(inp), vscode.ViewColumn.One);
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(out), vscode.ViewColumn.Two);
    }
}

async function add_testcase() {
    let path = current_problem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let index = 0;
    while (existsSync(xpath.join(path, TESTCASES, `${index}.hand.in`))){
        index += 1;
    }

    let inp = xpath.join(path, TESTCASES, `${index}.hand.in`);
    let out = xpath.join(path, TESTCASES, `${index}.hand.out`);

    writeFileSync(inp, "");
    writeFileSync(out, "");

    await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{}, {}]});
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(inp), vscode.ViewColumn.One);
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(out), vscode.ViewColumn.Two);
}

async function coding() {
    let path = current_problem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    await vscode.commands.executeCommand("vscode.setEditorLayout", { groups: [{}]});

    let sol = xpath.join(path, `sol.cpp`);

    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(sol), vscode.ViewColumn.One);
}

// TODO: Show time that the program took when it's ok
async function stress(){
    let path = current_problem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let command = `acmh stress -p ${path}`;

    await exec(command, async function(error, stdout, stderr) {
        let lines = stdout.split('\n');

        if (lines[0] === 'ok'){
            vscode.window.showInformationMessage("OK!");
        }
        else{
            vscode.window.showErrorMessage(`${lines[0]} on test ${lines[1]}`);
            await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{ groups: [{}], size: 0.5 }, { groups: [{}, {}, {}], size: 0.5 }] });

            // This is always true
            if (path !== undefined){
                let testid = lines[1];
                let sol = xpath.join(path, `sol.cpp`);
                let inp = xpath.join(path, TESTCASES, `${testid}.in`);
                let out = xpath.join(path, TESTCASES, `${testid}.out`);
                let cur = xpath.join(path, TESTCASES, `${testid}.cur`);

                // TODO: How to clear opened tabs?

                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(sol), vscode.ViewColumn.One);
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(inp), vscode.ViewColumn.Two);
                await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(out), vscode.ViewColumn.Three);

                // This file might not exist!
                if (existsSync(cur)){
                    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(cur), vscode.ViewColumn.Four);
                }
            }
        }
    });
}

async function upgrade(){
    let path = current_problem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let command = `acmh add --brute --gen -p ${path}`;

    await exec(command, async function(error, stdout, stderr) { });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "acmhelper-vscode" is now active!');

    let add_problem_commmand = vscode.commands.registerCommand('extension.addProblem', add_problem);
    let add_contest_command = vscode.commands.registerCommand('extension.addContest', add_contest);
    let run_solution_command = vscode.commands.registerCommand('extension.runSolution', run_solution);
    let open_testcase_command = vscode.commands.registerCommand('extension.openTestcase', open_testcase);
    let add_testcase_command = vscode.commands.registerCommand('extension.addTestcase', add_testcase);
    let coding_command = vscode.commands.registerCommand('extension.coding', coding);
    let stress_command = vscode.commands.registerCommand('extension.stress', stress);
    let upgrade_command = vscode.commands.registerCommand('extension.upgrade', upgrade);

    context.subscriptions.push(add_problem_commmand);
    context.subscriptions.push(add_contest_command);
    context.subscriptions.push(run_solution_command);
    context.subscriptions.push(open_testcase_command);
    context.subscriptions.push(add_testcase_command);
    context.subscriptions.push(coding_command);
    context.subscriptions.push(stress_command);
    context.subscriptions.push(upgrade_command);
}

// this method is called when your extension is deactivated
export function deactivate() {
}