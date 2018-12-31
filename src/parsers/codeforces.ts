import { SiteDescription, Contest, Problem } from "../types";

// TODO: Use sync requests
const request = require('request');

/**
 * contestId: ${contest}
 * http://codeforces.com/contest/${contest}/
 *
 * Example:
 * http://codeforces.com/contest/1081/
 */
function parseContest(contestId: string | number) {
    let problems: Problem[] = [];

    let res = request('GET', `http://codeforces.com/contest/${contestId}`);
    let body = res.getBody('utf8');

    console.log(body);

    let pos = body!.indexOf('<option value="generalAnnouncement" data-problem-name="" >', 0) + 1;

    while (true){
        let option_begin = body!.indexOf('option value="', pos) + 14;
        let option_end = body!.indexOf('" data-problem-name', option_begin);

        if (option_begin === -1 || option_end === -1){
            break;
        }

        pos = option_end;

        let problemId = body!.substring(option_begin, option_end);

        let prob = parseProblem(`${contestId}-${problemId}`);
        problems.push(prob);
    }

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