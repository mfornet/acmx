'use strict';
import * as vscode from 'vscode';
import { existsSync, writeFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { SITES } from './conn';
import { newContestFromId, testSolution, veredictName, stressSolution, upgradeArena, newProblemFromId, removeExtension } from './core';
import { Veredict } from './types';
import { currentProblem } from './core';

const TESTCASES = 'testcases';

function quickPickSites() {
    let sites: any[] = [];

    SITES.forEach(value => {
        sites.push({
            "label" : value.name,
            "target" : value.name,
            "description" : value.description,
        });
    });

    return sites;
}

// Create a new problem
async function addProblem() {
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage("Open the folder that will contain the problem.");
        return;
    }

    let path = vscode.workspace.workspaceFolders[0].uri.path;

    let site_info = await vscode.window.showQuickPick(quickPickSites(), { placeHolder: 'Select contest site' });

    if (site_info === undefined){
        vscode.window.showErrorMessage("Site not provided.");
        return;
    }

    let site = site_info.target;

    // TODO: 006
    let id = await vscode.window.showInputBox({placeHolder: "Problem ID"});

    if (id === undefined){
        vscode.window.showErrorMessage("Problem ID not provided.");
        return;
    }

    path = join(path, `${id}`);

    newProblemFromId(path, site, id);

    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path));
    // TODO: 007
    // Just want to run two commands below
    // await vscode.commands.executeCommand("vscode.open", vscode.Uri.file("sol.cpp"));
    // vscode.window.showInformationMessage(`Add problem ${site}/${id} at ${path}`);
}

async function addContest() {
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage("Open the folder that will contain the contest.");
        return;
    }

    let path = vscode.workspace.workspaceFolders[0].uri.path;

    let site_info = await vscode.window.showQuickPick(quickPickSites(), { placeHolder: 'Select contest site' });

    if (site_info === undefined){
        vscode.window.showErrorMessage("Site not provided.");
        return;
    }

    let site = site_info.target;
    let id = undefined;

    if (site === "personal"){
        let name= await vscode.window.showInputBox({placeHolder: "Contest Name"});

        if (name === undefined){
            vscode.window.showErrorMessage("Name not provided.");
            return;
        }

        path = join(path, name);

        let probCountStr = await vscode.window.showInputBox({placeHolder: "Number of problems"});

        if (name === undefined){
            vscode.window.showErrorMessage("Number of problems not provided.");
            return;
        }

        id = Number.parseInt(probCountStr!);
    }
    else{
        // TODO: 008
        id = await vscode.window.showInputBox({placeHolder: "Contest ID"});

        if (id === undefined){
            vscode.window.showErrorMessage("Contest ID not provided.");
            return;
        }

        path = join(path, `${id}`);
    }

    newContestFromId(path, site, id);

    vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path));
}

async function debugTestcase(path: string, tcId: string){
    // Change editor layout to show failing test
    await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{ groups: [{}], size: 0.5 }, { groups: [{}, {}, {}], size: 0.5 }] });

    let sol = join(path, `sol.cpp`);
    let inp = join(path, TESTCASES, `${tcId}.in`);
    let out = join(path, TESTCASES, `${tcId}.out`);
    let cur = join(path, TESTCASES, `${tcId}.real`);

    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(sol), vscode.ViewColumn.One);
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(inp), vscode.ViewColumn.Two);
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(out), vscode.ViewColumn.Three);

    // This file might not exist!
    if (existsSync(cur)){
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(cur), vscode.ViewColumn.Four);
    }
}

async function runSolution(){
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let result = testSolution(path);

    if (result.status === Veredict.OK){
        vscode.window.showInformationMessage(`OK. Time ${result.maxTime!}ms`);
    }
    else{
        vscode.window.showErrorMessage(`${veredictName(result.status)} on test ${result.failTcId}`);
        debugTestcase(path, result.failTcId!);
    }
}

async function openTestcase() {
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let tcs: any[] = [];

    // Read testcases
    readdirSync(join(path, TESTCASES)).
        filter( function (tcpath) {
            return extname(tcpath) === '.in';}).
        map( function(tcpath) {
            let name = removeExtension(tcpath);

            tcs.push({
                'label' : name,
                'target' : name,
            });
        });

    let tc = await vscode.window.showQuickPick(tcs, { placeHolder: 'Select testcase' });

    if (tc !== undefined){
        let inp = join(path, TESTCASES, `${tc.target}.in`);
        let out = join(path, TESTCASES, `${tc.target}.out`);

        await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{}, {}]});
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(inp), vscode.ViewColumn.One);
        await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(out), vscode.ViewColumn.Two);
    }
}

async function addTestcase() {
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let index = 0;
    while (existsSync(join(path, TESTCASES, `${index}.hand.in`))){
        index += 1;
    }

    let inp = join(path, TESTCASES, `${index}.hand.in`);
    let out = join(path, TESTCASES, `${index}.hand.out`);

    writeFileSync(inp, "");
    writeFileSync(out, "");

    await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{}, {}]});
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(inp), vscode.ViewColumn.One);
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(out), vscode.ViewColumn.Two);
}

async function coding() {
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    await vscode.commands.executeCommand("vscode.setEditorLayout", { groups: [{}]});

    let sol = join(path, `sol.cpp`);

    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(sol), vscode.ViewColumn.One);
}

async function stress(){
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let result = stressSolution(path);

    if (result.status === Veredict.OK){
        vscode.window.showInformationMessage(`OK. Time ${result.maxTime!}ms`);
    }
    else{
        vscode.window.showErrorMessage(`${veredictName(result.status)} on test ${result.failTcId}`);
        debugTestcase(path, result.failTcId!);
    }
}

async function upgrade(){
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    upgradeArena(path);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "acmhelper-vscode" is now active!');

    let addProblemCommand = vscode.commands.registerCommand('extension.addProblem', addProblem);
    let addContestCommand = vscode.commands.registerCommand('extension.addContest', addContest);
    let runSolutionCommand = vscode.commands.registerCommand('extension.runSolution', runSolution);
    let openTestcaseCommand = vscode.commands.registerCommand('extension.openTestcase', openTestcase);
    let addTestcaseCommand = vscode.commands.registerCommand('extension.addTestcase', addTestcase);
    let codingCommand = vscode.commands.registerCommand('extension.coding', coding);
    let stressCommand = vscode.commands.registerCommand('extension.stress', stress);
    let upgradeCommand = vscode.commands.registerCommand('extension.upgrade', upgrade);

    context.subscriptions.push(addProblemCommand);
    context.subscriptions.push(addContestCommand);
    context.subscriptions.push(runSolutionCommand);
    context.subscriptions.push(openTestcaseCommand);
    context.subscriptions.push(addTestcaseCommand);
    context.subscriptions.push(codingCommand);
    context.subscriptions.push(stressCommand);
    context.subscriptions.push(upgradeCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {
}