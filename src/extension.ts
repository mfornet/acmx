'use strict';
import * as vscode from 'vscode';
import { existsSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import { join, extname } from 'path';
import { SITES, getSite } from './conn';
import { newContestFromId, testSolution, verdictName, stressSolution, upgradeArena, newProblemFromId, removeExtension, solFile, initAcmX, currentProblem, compileCode, ATTIC, SRC } from './core';
import { Verdict, SiteDescription } from './types';
import { startCompetitiveCompanionService } from './companion';
import { hideTerminals } from './terminal';

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
    let site_info = await vscode.window.showQuickPick(quickPickSites(), { placeHolder: 'Select contest site' });

    if (site_info === undefined){
        vscode.window.showErrorMessage("Site not provided.");
        return;
    }

    let site: SiteDescription = getSite(site_info.target);

    let id = await vscode.window.showInputBox({placeHolder: site.problemIdPlaceholder});

    if (id === undefined){
        vscode.window.showErrorMessage("Problem ID not provided.");
        return;
    }

    let path: string | undefined = vscode.workspace.getConfiguration('acmx.configuration', null).get('solutionPath');
    path = join(path!, site.name, 'single');

    let problemPath = await newProblemFromId(path, site, id);

    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(problemPath));
    // TODO: 007
    // Just want to run two commands below
    // await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(solFile()));
    // vscode.window.showInformationMessage(`Add problem ${site}/${id} at ${path}`);
}

async function addContest() {
    let path: string | undefined = vscode.workspace.getConfiguration('acmx.configuration', null).get('solutionPath');
    let site_info = await vscode.window.showQuickPick(quickPickSites(), { placeHolder: 'Select contest site' });

    if (site_info === undefined){
        vscode.window.showErrorMessage("Site not provided.");
        return;
    }

    let site = getSite(site_info.target);
    let id = undefined;

    if (site.name === "empty"){
        let name= await vscode.window.showInputBox({placeHolder: site.contestIdPlaceholder});

        if (name === undefined){
            vscode.window.showErrorMessage("Name not provided.");
            return;
        }

        let probCountStr = await vscode.window.showInputBox({placeHolder: "Number of problems"});

        if (name === undefined){
            vscode.window.showErrorMessage("Number of problems not provided.");
            return;
        }

        id = name + '-' + probCountStr!;
    }
    else{
        id = await vscode.window.showInputBox({placeHolder: site.contestIdPlaceholder});

        if (id === undefined){
            vscode.window.showErrorMessage("Contest ID not provided.");
            return;
        }
    }

    let contestPath = await newContestFromId(path!, site, id);

    vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(contestPath));
}

async function debugTestcase(path: string, tcId: string){
    // Change editor layout to show failing test
    await vscode.commands.executeCommand("vscode.setEditorLayout", { orientation: 0, groups: [{ groups: [{}], size: 0.5 }, { groups: [{}, {}, {}], size: 0.5 }] });

    let sol = join(path, solFile());
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

    if (result.status === Verdict.OK){
        vscode.window.showInformationMessage(`OK. Time ${result.maxTime!}ms`);
    }
    else if (result.status === Verdict.NO_TESTCASES){
        vscode.window.showErrorMessage(`No testcases.`);
    }
    else{
        vscode.window.showErrorMessage(`${verdictName(result.status)} on test ${result.failTcId}`);
        debugTestcase(path, result.failTcId!);
    }
}

async function compile(){
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let sol = join(path, solFile());
    let out = join(path, ATTIC, 'sol');

    if (!existsSync(sol)){
        throw new Error("Open a coding environment first.");
    }

    // Compile solution
    let xresult = compileCode(sol, out);

    if (xresult.status !== 0){
        throw new Error(`Compilation Error. ${sol}`);
    }
    else{
        vscode.window.showInformationMessage("Compilation successfully.");
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
    hideTerminals();

    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    await vscode.commands.executeCommand("vscode.setEditorLayout", { groups: [{}]});

    let sol = join(path, solFile());

    await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(sol), vscode.ViewColumn.One);
}

async function stress(){
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let stressTimes: number | undefined = vscode.workspace.getConfiguration('acmx.stress', null).get('times');

    // Use default
    if (stressTimes === undefined){
        stressTimes = 10;
    }

    let result = stressSolution(path, stressTimes);

    if (result.status === Verdict.OK){
        vscode.window.showInformationMessage(`OK. Time ${result.maxTime!}ms`);
    }
    else{
        vscode.window.showErrorMessage(`${verdictName(result.status)} on test ${result.failTcId}`);
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

function fileList(dir: string): string[]{
    return readdirSync(dir).reduce((list: string[], file: string) => {
        return list.concat([file]);
    }, []);
}

async function setChecker(){
    let path = currentProblem();

    if (path === undefined){
        vscode.window.showErrorMessage("No active problem");
        return;
    }

    let all_checkers_plain = fileList(join(SRC, 'static', 'checkers'))
                                .filter((name: string) => name !== 'testlib.h')
                                .map((name: string) => name.slice(0, name.length - 4));

    let all_checkers = all_checkers_plain.map((value: string) => {
        return {
            'label' : value,
            'target' : value + '.cpp'
        };
    });

    let checker_info = await vscode.window.showQuickPick(all_checkers, { placeHolder: 'Select custom checker.' });

    if (checker_info === undefined){
        vscode.window.showErrorMessage("Checker not provided.");
        return;
    }

    let checker = checker_info.target;

    let checker_path = join(SRC, 'static', 'checkers', checker);
    let checker_dest = join(path, ATTIC, 'checker.cpp');

    copyFileSync(checker_path, checker_dest);
}

async function debugTest(){
    console.log("no bugs :O");
}

// TODO: Make all the code async.
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    initAcmX();
    startCompetitiveCompanionService();

    let addProblemCommand = vscode.commands.registerCommand('acmx.addProblem', addProblem);
    let addContestCommand = vscode.commands.registerCommand('acmx.addContest', addContest);
    let runSolutionCommand = vscode.commands.registerCommand('acmx.runSolution', runSolution);
    let openTestcaseCommand = vscode.commands.registerCommand('acmx.openTestcase', openTestcase);
    let addTestcaseCommand = vscode.commands.registerCommand('acmx.addTestcase', addTestcase);
    let codingCommand = vscode.commands.registerCommand('acmx.coding', coding);
    let stressCommand = vscode.commands.registerCommand('acmx.stress', stress);
    let upgradeCommand = vscode.commands.registerCommand('acmx.upgrade', upgrade);
    let compileCommand = vscode.commands.registerCommand('acmx.compile', compile);
    let setCheckerCommand = vscode.commands.registerCommand('acmx.setChecker', setChecker);

    let debugTestCommand = vscode.commands.registerCommand('acmx.debugTest', debugTest);

    context.subscriptions.push(addProblemCommand);
    context.subscriptions.push(addContestCommand);
    context.subscriptions.push(runSolutionCommand);
    context.subscriptions.push(openTestcaseCommand);
    context.subscriptions.push(addTestcaseCommand);
    context.subscriptions.push(codingCommand);
    context.subscriptions.push(stressCommand);
    context.subscriptions.push(upgradeCommand);
    context.subscriptions.push(compileCommand);
    context.subscriptions.push(setCheckerCommand);

    context.subscriptions.push(debugTestCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {
}