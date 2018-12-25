//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { dirname, join } from 'path';
import { timedRun, testcasesName, testSolution, newArena, ATTIC, TESTCASES, upgradeArena, stressSolution, newProblemFromId, newContestFromId } from '../core';
import { TestcaseResult, Veredict } from '../types';
import { rmdirSync, existsSync, readdirSync, unlinkSync, openSync, writeSync, closeSync, readSync } from 'fs';

const SRC = join(dirname(dirname(dirname(__filename))), 'src', 'test');
const ARENA = join(SRC, 'arena');

suite("Extension Tests", function () {
    /**
     * Recursive remove
     */
    function recRmdir(path: string){
        readdirSync(path).forEach(name => {
            let cPath = join(path, name);

            try{
                unlinkSync(cPath);
            }
            catch(err){
                recRmdir(cPath);
            }
        });

        rmdirSync(path);
    }

    function writeFile(path: string, content: string){
        let currentFd = openSync(path, 'w');
        writeSync(currentFd, content);
        closeSync(currentFd);
    }

    /**
     * core::newArena
     */
    test("newArena", function(){
        let path = join(ARENA, "testNew");

        if (existsSync(path)){
            recRmdir(path);
        }

        assert.equal(existsSync(path), false);

        newArena(path);

        assert.equal(existsSync(join(path, 'sol.cpp')), true);
        assert.equal(existsSync(join(path, ATTIC)), true);
        assert.equal(existsSync(join(path, ATTIC, 'checker')), true);
        assert.equal(existsSync(join(path, TESTCASES)), true);

        recRmdir(path);
    });

    /**
     * core::upgradeArena
     */
    test("upgradeArena", function(){
        let path = join(ARENA, "testUpgrade");

        if (existsSync(path)){
            recRmdir(path);
        }

        assert.equal(existsSync(path), false);

        newArena(path);
        upgradeArena(path);

        assert.equal(existsSync(join(path, ATTIC, 'gen.py')), true);
        assert.equal(existsSync(join(path, 'brute.cpp')), true);

        recRmdir(path);
    });

    /**
     * core::testcasesName
     */
    test("testcasesName", function(){
        let path = join(ARENA, 'exampleContest', 'A');
        let result = testcasesName(path);
        let target = ["0", "1", "2"];

        // TODO: How to check if two arrays are equal
        // I want to compare `result` & `target`
        target.forEach(name => {assert.notEqual(result.findIndex(tname => { return tname === name; }), -1);});
        result.forEach(name => {assert.notEqual(target.findIndex(tname => { return tname === name; }), -1);});
    });

    /**
     * core::newProblem
     */
    test("newProblemFromId", function(){
        let problemId = 'testProblemFromId';
        let path = join(ARENA, problemId);

        assert.equal(existsSync(path), false);

        newProblemFromId(path, 'personal', problemId);

        assert.equal(existsSync(join(path, 'sol.cpp')), true);
        assert.equal(existsSync(join(path, ATTIC)), true);
        assert.equal(existsSync(join(path, TESTCASES)), true);
        assert.equal(readdirSync(join(path, TESTCASES)).length, 6);

        recRmdir(path);
    });

    /**
     * core::newProblem
     */
    test("newContestFromId", function(){
        let contestId = 'testContestFromId';
        let path = join(ARENA, contestId);

        assert.equal(existsSync(path), false);

        newContestFromId(path, 'personal', 5);

        assert.equal(readdirSync(path).length, 5);

        recRmdir(path);
    });

    /**
     * core::timedRun
     *
     * Test running one single test cases, and receiving all different veredicts
     */
    test("timedRunOk", function() {
        let exampleContest = join(ARENA, 'exampleContest');
        let problem = join(exampleContest, 'A');
        let testcaseId = '0';
        let result: TestcaseResult = timedRun(problem, testcaseId);
        assert.equal(result.status, Veredict.OK);
    });

    test("timedRunWA", function() {
        let exampleContest = join(ARENA, 'exampleContest');
        let problem = join(exampleContest, 'B');
        let testcaseId = '0';
        let result: TestcaseResult = timedRun(problem, testcaseId);
        assert.equal(result.status, Veredict.WA);
    });

    test("timedRunRTE", function() {
        let exampleContest = join(ARENA, 'exampleContest');
        let problem = join(exampleContest, 'C');
        let testcaseId = '0';
        let result: TestcaseResult = timedRun(problem, testcaseId);
        assert.equal(result.status, Veredict.RTE);
    });

    test("timedRunTLE", function() {
        let exampleContest = join(ARENA, 'exampleContest');
        let problem = join(exampleContest, 'D');
        let testcaseId = '0';
        let result: TestcaseResult = timedRun(problem, testcaseId, 100);
        assert.equal(result.status, Veredict.TLE);
    });

    /**
     * core::testSolution
     *
     * Test running one single test cases, and receiving all different veredicts
     */
    test("testSolutionOK", function() {
        let exampleContest = join(ARENA, 'exampleContest');
        let problem = join(exampleContest, 'A');
        let result: TestcaseResult = testSolution(problem);
        assert.equal(result.status, Veredict.OK);
    });

    test("testSolutionCE", function() {
        let exampleContest = join(ARENA, 'exampleContest');
        let problem = join(exampleContest, 'E');
        let result: TestcaseResult = testSolution(problem);
        assert.equal(result.status, Veredict.CE);
    });

    /**
     * core::stressSolution
     */
    test("stressSolutionOK", function() {
        let path = join(ARENA, 'testStressOK');

        if (existsSync(path)){
            recRmdir(path);
        }

        assert.equal(existsSync(path), false);

        newArena(path);
        upgradeArena(path);

        // populate sol.cpp
        writeFile(join(path, "sol.cpp"),
        `#include <iostream>\n` +
        `\n` +
        `using namespace std;\n` +
        `\n` +
        `int main(){\n` +
        `   int n; cin >> n;\n` +
        `   cout << n + 2 << endl;\n` +
        `   return 0;\n` +
        `}\n`
        );

        // populate brute.cpp
        writeFile(join(path, "brute.cpp"),
        `#include <iostream>\n` +
        `\n` +
        `using namespace std;\n` +
        `\n` +
        `int main(){\n` +
        `   int n; cin >> n;\n` +
        `   cout << n + 2 << endl;\n` +
        `   return 0;\n` +
        `}\n`
        );

        // populate gen.py
        writeFile(join(path, ATTIC, 'gen.py'),
        `import random\n` +
        `print(random.randint(0, 99))\n`
        );

        let result = stressSolution(path);

        assert.equal(result.status, Veredict.OK);

        recRmdir(path);
    });

    test("stressSolutionWA", function() {
        let path = join(ARENA, 'testStressWA');

        if (existsSync(path)){
            recRmdir(path);
        }

        assert.equal(existsSync(path), false);

        newArena(path);
        upgradeArena(path);

        // populate sol.cpp
        writeFile(join(path, "sol.cpp"),
        `#include <iostream>\n` +
        `\n` +
        `using namespace std;\n` +
        `\n` +
        `int main(){\n` +
        `   int n; cin >> n;\n` +
        `   cout << n + 3 << endl;\n` +
        `   return 0;\n` +
        `}\n`
        );

        // populate brute.cpp
        writeFile(join(path, "brute.cpp"),
        `#include <iostream>\n` +
        `\n` +
        `using namespace std;\n` +
        `\n` +
        `int main(){\n` +
        `   int n; cin >> n;\n` +
        `   cout << n + 2 << endl;\n` +
        `   return 0;\n` +
        `}\n`
        );

        // populate gen.py
        writeFile(join(path, ATTIC, 'gen.py'),
        `import random\n` +
        `print(random.randint(0, 99))\n`
        );

        let result = stressSolution(path);

        assert.equal(result.status, Veredict.WA);

        recRmdir(path);
    });

    // test("downloading", function(){
    //     let request = require('sync-request');

    //     console.log("Start downloading...");
    //     var res = request('GET', 'http://codeforces.com/contest/1081/problem/E');
    //     console.log("Downloaded...");
    //     let html: string = res.getBody('utf8');

    //     let fd = openSync("/home/marx/xxx.html", "w");
    //     writeSync(fd, html);
    //     closeSync(fd);
    // });

    function readFile(path: string){
        let fd = openSync(path, "r");
        let buffer = new Buffer(1 << 20);
        readSync(fd, buffer, 0, 1 << 20, 0);
        let answer = buffer.toString();
        return answer;
    }

    test("parsing", function(){
        let html: string = readFile(join(__dirname, "codeforces.html"));
        let pos = 0;

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
        }
    });
});