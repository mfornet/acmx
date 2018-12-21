'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { exec } from 'child_process';

// Create a new problem
async function add_problem() {
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage("Open the folder that will contain the problem.");
        return;
    }

    let path = vscode.workspace.workspaceFolders[0].uri.path;

    let site_info = await vscode.window.showQuickPick(
        [
            { label: 'Codeforces', target: 'codeforces' },
            // TODO: Disable this for real application
            { label: 'Mock', description: 'Fake site for experimentation', target: 'mock' },
        ],
        { placeHolder: 'Select contest site' });

    if (site_info === undefined){
        vscode.window.showErrorMessage("Site not provided.");
        return;
    }

    let site = site_info.target;

    let pid = await vscode.window.showInputBox({placeHolder: "Problem ID"});

    if (pid === undefined){
        vscode.window.showErrorMessage("Problem ID not provided.");
        return;
    }

    // TODO: Use builtin path join from typescript to be cross-platform
    path += `/${pid}`;

    let command = `acmh problem ${site} ${pid} -p ${path}`;

    exec(command, function(error, stdout, stderr) {
        console.log(command);
        console.log(stdout);
        console.log(stderr);

        vscode.window.showInformationMessage(`Add problem ${site}/${pid} at ${path}`);
    });

    // TODO: Open new problem folder with active window at sol.cpp
}

async function add_contest() {
    vscode.window.showInformationMessage("Add Contest coming SOON!");
}

async function run_solution(){
    vscode.window.showInformationMessage("Run solution coming SOON!");
}

async function stress(){
    vscode.window.showInformationMessage("Stress coming SOON!");
}

async function upgrade(){
    vscode.window.showInformationMessage("Upgrade coming SOON!");
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "acmhelper-vscode" is now active!');

    let add_problem_commmand = vscode.commands.registerCommand('extension.addProblem', add_problem);
    let add_contest_command = vscode.commands.registerCommand('extension.addContest', add_contest);
    let run_solution_command = vscode.commands.registerCommand('extension.runSolution', run_solution);
    let stress_command = vscode.commands.registerCommand('extension.stress', stress);
    let upgrade_command = vscode.commands.registerCommand('extension.upgrade', upgrade);

    context.subscriptions.push(add_problem_commmand);
    context.subscriptions.push(add_contest_command);
    context.subscriptions.push(run_solution_command);
    context.subscriptions.push(stress_command);
    context.subscriptions.push(upgrade_command);
}

// this method is called when your extension is deactivated
export function deactivate() {
}