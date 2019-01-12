import { SiteDescription, Contest, Problem } from "../types";

import * as vscode from 'vscode';
import JSSoup from 'jssoup';
import * as got from 'got';
import { getText } from './util';

/**
 * contestId: ${contest}
 * http://codeforces.com/contest/${contest}/
 *
 * Example:
 * http://codeforces.com/contest/1081/
 */
export async function parseContest(contestId: string) {
    let url = `http://codeforces.com/contest/${contestId}`;
    let response = await got.get(url);

    if (response.statusCode !== 200){
        throw new Error(`Contest ${url} not downloaded. ${response.statusCode}`);
    }

    vscode.window.showInformationMessage(`Downloading contest ${contestId}...`);

    let soup = new JSSoup(response.body);
    let problemsTable = soup.find("table", "problems");
    let problems: Problem[] = [];
    let problemSection = problemsTable.findAll("td", "id");

    for (let i = 0; i < problemSection.length; i++){
        let section = problemSection[i];
        let hrefData = section.find("a").attrs.href.split('/');
        let pid = hrefData[hrefData.length - 1];
        console.log(`Problem ${contestId}-${pid}`);

        let prob = await parseProblem(contestId + "-" + pid);
        problems.push(prob);
    }

    let name: string = soup.find("div", "sidebar").find("a").text;
    name = name.toLowerCase().replace(' ', '-');

    return new Contest(name, problems);
}

/**
 * problemId: ${contest}-${problem}
 * http://codeforces.com/contest/${contest}/problem/${problem}
 *
 * Example:
 * http://codeforces.com/contest/1081/problem/E
 */
export async function parseProblem(problemId: string) {
    let data = problemId.split('-');
    let contest = data[0];
    let pid = data[1];

    let url = `http://codeforces.com/contest/${contest}/problem/${pid}`;
    let response = await got.get(url);

    if (response.statusCode !== 200){
        throw new Error(`Problem ${url} not downloaded. ${response.statusCode}`);
    }

    let soup = new JSSoup(response.body);
    let problemDescription = soup.find("div", "problemindexholder");

    let name = problemDescription.find("div", "title").text;

    let inputTC: string[] = [];
    let outputTC: string[] = [];

    problemDescription.findAll("div", "input").forEach((element: any) =>{
        let tc = element.find("pre");
        inputTC.push(getText(tc));
    });

    problemDescription.findAll("div", "output").forEach((element: any) =>{
        let tc = element.find("pre");
        outputTC.push(getText(tc));
    });

    vscode.window.showInformationMessage(`Downloaded problem ${problemId}!`);

    return new Problem(pid, name, inputTC, outputTC);
}

export const CODEFORCES = new SiteDescription(
        "codeforces",
        "codeforces.com",
        "{contest id} (Ex: 1095)",
        "{contest id}-{problem id} (Ex: 1095-A)",
        parseContest,
        parseProblem,
    );