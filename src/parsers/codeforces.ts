import { SiteDescription, Contest, Problem } from "../types";

// TODO: Use sync requests
const request = require('sync-request');

/**
 * contestId: ${contest}
 * http://codeforces.com/contest/${contest}/
 *
 * Example:
 * http://codeforces.com/contest/1081/
 */
function parseContest(contestId: string | number) {
    let problemsId: string[] = [];

    let problems: Problem[] = [];

    problemsId.forEach(problemId => {
        let prob = parseProblem(`${contestId}-${problemId}`);
        problems.push(prob);
    });

    return new Contest(problems);
}

/**
 * problemId: ${contest}-${problem}
 * http://codeforces.com/contest/${contest}/problem/${problem}
 *
 * Example:
 * http://codeforces.com/contest/1081/problem/E
 */
function parseProblem(problemId: string) {
    let data = problemId.split('-');
    let contest = data[0];
    let problem = data[1];

    var res = request('GET', `http://codeforces.com/contest/${contest}/problem/${problem}`);

    let html: string = res.getBody('utf8');
    let pos = 0;

    let inputs = [];
    let outputs = [];

    while (true){
        pos = html.indexOf('<div class="title">Input</div>', pos);

        if (pos === -1){
            break;
        }

        let begin_pre = html.indexOf('<pre>', pos);
        let end_pre = html.indexOf('</pre>', pos);

        let inputTestcase = html.substring(begin_pre + 5, end_pre);

        while (inputTestcase.indexOf('<br />') !== -1){
            inputTestcase = inputTestcase.replace('<br />', '\n');
        }

        pos = html.indexOf('<div class="title">Output</div>', pos);

        begin_pre = html.indexOf('<pre>', pos);
        end_pre = html.indexOf('</pre>', pos);

        let outputTestcase = html.substring(begin_pre + 5, end_pre);

        while (outputTestcase.indexOf('<br />') !== -1){
            outputTestcase = outputTestcase.replace('<br />', '\n');
        }

        inputs.push(inputTestcase);
        outputs.push(outputTestcase);
    }

    return new Problem(problem, inputs, outputs);
}

export const CODEFORCES = new SiteDescription(
        "codeforces",
        "codeforces.com",
        parseContest,
        parseProblem,
    );