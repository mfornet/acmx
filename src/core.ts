'use strict';
import { mkdirSync, existsSync, copyFileSync, openSync, readSync, readdirSync, writeSync, closeSync } from "fs";
import { dirname, join, extname } from "path";
import * as child_process from 'child_process';
import * as gwen from './gwen';
import { TestcaseResult, Veredict, SolutionResult, Problem, Contest } from "./types";
import { getSite } from "./conn";

export const TESTCASES = 'testcases';
export const ATTIC = 'attic';
const SRC = dirname(__filename);
const TESTCASE_TIMEOUT = 1000;
// TODO: Revisit this constant. Show specific error to know when this is an issue
const MAX_SIZE_INPUT = 1024;

function createFolder(path: string){
    if (!existsSync(path)){
        createFolder(dirname(path));
        mkdirSync(path);
    }
}

export function newArena(path: string){
    createFolder(path);

    let testcases = join(path, TESTCASES);
    createFolder(testcases);

    let attic = join(path, ATTIC);
    createFolder(attic);

    copyFileSync(join(SRC, 'static', 'sol.cpp'), join(path, 'sol.cpp'));
    copyFileSync(join(SRC, 'static', 'checker'), join(path, ATTIC, 'checker'));
}

export function removeExtension(name: string){
    let split = name.split('.');
    if (split.length === 0){
        return name;
    }
    else{
        split.pop(); // drop extension
        return split.join('.');
    }
}

export function testcasesName(path: string){
    return readdirSync(join(path, TESTCASES)).
            filter( function (tcpath) {
                return extname(tcpath) === '.in';
            }).
            map( function(tcpath) { return removeExtension(tcpath); });
}

function testcases(path: string){
    return testcasesName(path).map(function (name){
        let inp_fd = openSync(join(path, TESTCASES, `${name}.in`), 'r');
        let out_fd = openSync(join(path, TESTCASES, `${name}.out`), 'r');

        let inp_buffer = new Buffer(MAX_SIZE_INPUT);
        let out_buffer = new Buffer(MAX_SIZE_INPUT);

        readSync(inp_fd, inp_buffer, 0, MAX_SIZE_INPUT, 0);
        readSync(out_fd, out_buffer, 0, MAX_SIZE_INPUT, 0);

        return [
            inp_buffer.toString(),
            out_buffer.toString()
        ];
    });
}

export function upgradeArena(path: string) {
    let brute = join(path, 'brute.cpp');

    if (!existsSync(brute)){
        // Create brute.cpp file
        copyFileSync(join(SRC, 'static', 'sol.cpp'), brute);
    }

    let generator = join(path, ATTIC, 'gen.py');

    if (!existsSync(generator)){
        // Create generator
        let inputs: string[] = [];
        let outputs: string[] = [];

        testcases(path).forEach(function(testcases){
            inputs.push(testcases[0]);
            outputs.push(testcases[1]);
        });

        let generator_template = gwen.create(inputs, outputs);
        let generator_fd = openSync(generator, 'w');
        writeSync(generator_fd, generator_template);
    }
}

function newProblem(path: string, problem: Problem){
    newArena(path);

    problem.inputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.in`), 'w');
        writeSync(fd, value);
    });

    problem.outputs!.forEach((value, index) => {
        let fd = openSync(join(path, TESTCASES, `${index}.out`), 'w');
        writeSync(fd, value);
    });
}

export function newProblemFromId(path: string, site: string, problemId: string){
    let siteDesc = getSite(site);

    let problem = siteDesc.problemParser(problemId);

    newProblem(path, problem);
}

function newContest(path: string, contest: Contest){
    contest.problems!.forEach(problem => {
        newProblem(join(path, problem.name!), problem);
    });
}

/**
 * Create a contest
 *
 * @param contestId Can be a number if the site is `personal` and this number denote number of problems
 */
export function newContestFromId(path: string, site: string, contestId: string | number){
    createFolder(path);
    let siteDesc = getSite(site);
    let contest = siteDesc.contestParser(contestId);
    newContest(path, contest);
}

export function timedRun(path: string, tcName: string, timeout = TESTCASE_TIMEOUT){
    let tcInput = join(path, TESTCASES, `${tcName}.in`);
    let tcOutput = join(path, TESTCASES, `${tcName}.out`);
    let tcCurrent = join(path, TESTCASES, `${tcName}.cur`);

    let inputFd = openSync(tcInput, 'r');
    let buffer = new Buffer(MAX_SIZE_INPUT);
    readSync(inputFd, buffer, 0, MAX_SIZE_INPUT, 0);
    let tcData = buffer.toString();
    closeSync(inputFd);

    let startTime = new Date().getTime();
    let command = `${join(path, ATTIC, "sol")}`;

    let xresult = child_process.spawnSync(command, {
        input: tcData,
        timeout,
        killSignal: "SIGTERM"
    });

    // Check if an error happened
    if (xresult.status !== 0){
        if (xresult.error === undefined){
            return new TestcaseResult(Veredict.RTE);
        }
        else{
            return new TestcaseResult(Veredict.TLE);
        }
    }

    let spanTime = new Date().getTime() - startTime;

    // Check output is ok
    let currentFd = openSync(tcCurrent, 'w');
    writeSync(currentFd, xresult.stdout);
    closeSync(currentFd);

    let checker_result = child_process.spawnSync(join(path, ATTIC, 'checker'), [tcInput, tcCurrent, tcOutput]);

    if (checker_result.status !== 0){
        return new TestcaseResult(Veredict.WA);
    }
    else{
        return new TestcaseResult(Veredict.OK, spanTime);
    }
}

function compileCode(pathCode: string, pathOutput: string){
    // # TODO: Avoid this hardcoded line. Use personalized compile line. increase stack by default
    return child_process.spawnSync("g++", ["-std=c++11", `${pathCode}`, "-o", `${pathOutput}`]);
}

export function testSolution(path: string){
    let sol = join(path, 'sol.cpp');
    let out = join(path, ATTIC, 'sol');

    if (!existsSync(sol)){
        throw new Error("Open a coding environment first.");
    }

    // Compile solution
    let xresult = compileCode(sol, out);

    if (xresult.status !== 0){
        return new SolutionResult(Veredict.CE);
    }

    let testcasesId = testcasesName(path);
    testcasesId.sort(); // Proccess all testcases in sorted order

    console.log("Test Solution at: ", testcasesId);

    let results = [];
    let fail = undefined;

    testcasesId.forEach(tcId => {
        let tcResult = timedRun(path, tcId);

        if (tcResult.status !== Veredict.OK){
            fail = new SolutionResult(tcResult.status, tcId);
        }

        results.push(tcResult);
    });

    if (fail === undefined){
        // TODO: IMPORTANT: Report max time and maybe other stats. Same with stress
        return new SolutionResult(Veredict.OK);
    }
    else{
        return fail;
    }
}

function generateTestcase(path: string){
    // TODO: NILOX: Revisit this call to python3. How to make it cross platform
    let genResult = child_process.spawnSync("python3", [join(path, ATTIC, 'gen.py')]);

    let currentFd = openSync(join(path, TESTCASES, 'gen.in'), 'w');
    writeSync(currentFd, genResult.stdout);
    closeSync(currentFd);
}

export function stressSolution(path: string, times: number = 10){
    let sol = join(path, 'sol.cpp');
    let out = join(path, ATTIC, 'sol');
    let brute = join(path, 'brute.cpp');

    if (!existsSync(sol)){
        throw new Error("Open a coding environment first.");
    }

    if (!existsSync(brute)){
        throw new Error("Upgrade environment first.");
    }

    let brout = join(path, ATTIC, 'brout');

    let solCompileResult = compileCode(sol, out);
    if (solCompileResult.status !== 0){
        throw new Error("Compilation Error. sol.cpp");
    }

    let bruteCompileResult = compileCode(brute, brout);
    if (bruteCompileResult.status !== 0){
        throw new Error("Compilation Error. brute.cpp");
    }

    let history = [];

    for (let index = 0; index < times; index++) {
        // Generate input testcase
        generateTestcase(path);

        // Generate output testcase from brute.cpp
        let inputFd = openSync(join(path, TESTCASES, 'gen.in'), 'r');
        let buffer = new Buffer(MAX_SIZE_INPUT);
        readSync(inputFd, buffer, 0, MAX_SIZE_INPUT, 0);
        let tcData = buffer.toString();
        closeSync(inputFd);

        // Run without restrictions
        // TODO: EASY: Restrict brute in time, and capture errors
        let runResult = child_process.spawnSync(brout, {
            input: tcData,
        });

        // Finally write .out
        let currentFd = openSync(join(path, TESTCASES, 'gen.out'), 'w');
        writeSync(currentFd, runResult.stdout);
        closeSync(currentFd);

        // Check sol.cpp report same result than brute.cpp
        let result = timedRun(path, 'gen');

        if (result.status !== Veredict.OK){
            return new SolutionResult(result.status, 'gen');
        }

        history.push(result);
    }

    // TODO: Check testSolution comment on this point
    return new SolutionResult(Veredict.OK);
}

export function veredictName(veredict: Veredict){
    switch (veredict) {
        case Veredict.OK:
            return "OK";

        case Veredict.WA:
            return "WA";

        case Veredict.TLE:
            return "TLE";

        case Veredict.RTE:
            return "RTE";

        case Veredict.CE:
            return "CE";

        default:
            throw new Error("Invalid Veredict");
    }
}