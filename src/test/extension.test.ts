// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { getSite, PERSONAL, SITES } from '../conn';
import { ATTIC, newArena, newContestFromId, newProblemFromId, TESTCASES, testcasesName, testSolution, upgradeArena } from '../core';
import { TestcaseResult, Verdict } from '../types';
import { recRmdir } from './test_utils';

const ARENA = join(dirname(dirname(dirname(__filename))), 'src', 'test', 'arena');

SITES.push(PERSONAL);
process.env.ACMX_TESTING = "1";

suite("Extension Tests", function () {
    /**
     * core::newArena
     */
    test("newArena", function () {
        let path = join(ARENA, "testNew");

        if (existsSync(path)) {
            recRmdir(path);
        }

        assert.equal(existsSync(path), false);

        newArena(path);

        assert.equal(existsSync(join(path, 'sol.cpp')), true);
        assert.equal(existsSync(join(path, ATTIC)), true);
        assert.equal(existsSync(join(path, TESTCASES)), true);

        recRmdir(path);
    });

    /**
     * core::upgradeArena
     */
    test("upgradeArena", function () {
        let path = join(ARENA, "testUpgrade");

        if (existsSync(path)) {
            recRmdir(path);
        }

        assert.equal(existsSync(path), false);

        newArena(path);
        upgradeArena(path);

        assert.equal(existsSync(join(path, 'gen.py')), true);
        assert.equal(existsSync(join(path, 'brute.cpp')), true);

        recRmdir(path);
    });

    /**
     * core::testcasesName
     */
    test("testcasesName", function () {
        let path = join(ARENA, 'exampleContest', 'A');
        let result = testcasesName(path);
        let target = ["0", "1", "2"];

        assert.equal(result.length, target.length);

        result.sort();

        for (let i = 0; i < 3; ++i) {
            assert.equal(target[i], result[i]);
        }
    });

    /**
     * core::newProblem
     */
    test("newProblemFromId", async function () {
        let problemId = 'testProblemFromId';
        let path = join(ARENA, problemId);

        assert.equal(existsSync(path), false);
        await newProblemFromId(ARENA, getSite('personal'), problemId);

        assert.equal(existsSync(join(path, 'sol.cpp')), true, "Solution not found.");
        assert.equal(existsSync(join(path, ATTIC)), true, "Attic not found.");
        assert.equal(existsSync(join(path, TESTCASES)), true, "Testcases not found.");
        assert.equal(readdirSync(join(path, TESTCASES)).length, 6, "Incorrect number of files.");

        recRmdir(path);
    });

    /**
     * core::newContestFromId
     */
    test("newContestFromId", async function () {
        let contestId = 'testContestFromId';
        let path = join(ARENA, contestId);

        if (existsSync(path)) {
            recRmdir(path);
        }

        assert.equal(existsSync(path), false);

        await newContestFromId(path, getSite('empty'), "5");

        assert.equal(readdirSync(path).length, 1);

        recRmdir(path);
    });

    /**
     * core::timedRun
     *
     * Test running one single test cases, and receiving all different verdicts
     */
    // test("timedRunOk", function () {
    //     let exampleContest = join(ARENA, 'exampleContest');
    //     let problem = join(exampleContest, 'A');
    //     let testcaseId = '0';
    //     let result: TestcaseResult = timedRun(problem, testcaseId, getTimeout());
    //     assert.equal(result.status, Verdict.OK);
    // });

    // test("timedRunWA", function () {
    //     let exampleContest = join(ARENA, 'exampleContest');
    //     let problem = join(exampleContest, 'B');
    //     let testcaseId = '0';
    //     let result: TestcaseResult = timedRun(problem, testcaseId, getTimeout());
    //     assert.equal(result.status, Verdict.WA);
    // });

    // test("timedRunRTE", function () {
    //     let exampleContest = join(ARENA, 'exampleContest');
    //     let problem = join(exampleContest, 'C');
    //     let testcaseId = '0';
    //     let result: TestcaseResult = timedRun(problem, testcaseId, getTimeout());
    //     assert.equal(result.status, Verdict.RTE);
    // });

    // test("timedRunTLE", function () {
    //     let exampleContest = join(ARENA, 'exampleContest');
    //     let problem = join(exampleContest, 'D');
    //     let testcaseId = '0';
    //     let result: TestcaseResult = timedRun(problem, testcaseId, 100);
    //     assert.equal(result.status, Verdict.TLE);
    // });

    /**
     * core::testSolution
     *
     * Test running one single test cases, and receiving all different verdicts
     */
    test("testSolutionOK", function () {
        let exampleContest = join(ARENA, 'exampleContest');
        let problem = join(exampleContest, 'A');
        let result: TestcaseResult = testSolution(problem);
        assert.equal(result.status, Verdict.OK);
    });

    // TODO: Disable stderr
    // test("testSolutionCE", function () {
    //     let exampleContest = join(ARENA, 'exampleContest');
    //     let problem = join(exampleContest, 'E');
    //     let result = testSolution(problem);
    //     assert.equal(result.status, Verdict.CE);
    // });

    /**
     * core::stressSolution
     */
    // test("stressSolutionOK", function () {
    //     let path = join(ARENA, 'testStressOK');

    //     if (existsSync(path)) {
    //         recRmdir(path);
    //     }

    //     assert.equal(existsSync(path), false);

    //     newArena(path);
    //     upgradeArena(path);

    //     // populate sol.cpp
    //     writeFile(join(path, "sol.cpp"),
    //         `#include <iostream>\n` +
    //         `\n` +
    //         `using namespace std;\n` +
    //         `\n` +
    //         `int main(){\n` +
    //         `   int n; cin >> n;\n` +
    //         `   cout << n + 2 << endl;\n` +
    //         `   return 0;\n` +
    //         `}\n`
    //     );

    //     // populate brute.cpp
    //     writeFile(join(path, "brute.cpp"),
    //         `#include <iostream>\n` +
    //         `\n` +
    //         `using namespace std;\n` +
    //         `\n` +
    //         `int main(){\n` +
    //         `   int n; cin >> n;\n` +
    //         `   cout << n + 2 << endl;\n` +
    //         `   return 0;\n` +
    //         `}\n`
    //     );

    //     // populate gen.py
    //     writeFile(join(path, 'gen.py'),
    //         `import random\n` +
    //         `print(random.randint(0, 99))\n`
    //     );

    //     let result = stressSolution(path, 10);

    //     assert.equal(result.status, Verdict.OK);

    //     recRmdir(path);
    // });

    // test("stressSolutionWA", function () {
    //     let path = join(ARENA, 'testStressWA');

    //     if (existsSync(path)) {
    //         recRmdir(path);
    //     }

    //     assert.equal(existsSync(path), false);

    //     newArena(path);
    //     upgradeArena(path);

    //     // populate sol.cpp
    //     writeFile(join(path, "sol.cpp"),
    //         `#include <iostream>\n` +
    //         `\n` +
    //         `using namespace std;\n` +
    //         `\n` +
    //         `int main(){\n` +
    //         `   int n; cin >> n;\n` +
    //         `   cout << n + 3 << endl;\n` +
    //         `   return 0;\n` +
    //         `}\n`
    //     );

    //     // populate brute.cpp
    //     writeFile(join(path, "brute.cpp"),
    //         `#include <iostream>\n` +
    //         `\n` +
    //         `using namespace std;\n` +
    //         `\n` +
    //         `int main(){\n` +
    //         `   int n; cin >> n;\n` +
    //         `   cout << n + 2 << endl;\n` +
    //         `   return 0;\n` +
    //         `}\n`
    //     );

    //     // populate gen.py
    //     writeFile(join(path, ATTIC, 'gen.py'),
    //         `import random\n` +
    //         `print(random.randint(0, 99))\n`
    //     );

    //     let result = stressSolution(path, 10);

    //     assert.equal(result.status, Verdict.WA);

    //     recRmdir(path);
    // });
});