import * as assert from "assert";

import * as vscode from "vscode";
import { newArena, ATTIC, TESTCASES, upgradeArena, pathToStatic, testCasesName, newProblemFromId, timedRun, compileCode, globalAtticPath, initAcmX } from "../../core";
import { existsSync, readdirSync, copyFileSync } from "fs";
import { join } from "path";
import { runWithTemporaryPath, MOCK_SITE, runWithCopiedFolder } from "../testUtils";
import { TestCaseResult, Verdict } from "../../types";

const CONTEST = join(pathToStatic(), 'testData', 'exampleContest');

suite("Extension Test Suite", () => {
    vscode.window.showInformationMessage("Start all tests.");

    test("New Arena", () => {
        runWithTemporaryPath((path: string) => {
            newArena(path);
            assert.ok(existsSync(join(path, "sol.cpp")));
            assert.ok(existsSync(join(path, ATTIC)));
            assert.ok(existsSync(join(path, TESTCASES)));
        });
    });

    test("Upgrade Arena", function () {
        runWithTemporaryPath((path: string) => {
            newArena(path);
            upgradeArena(path);

            assert.ok(existsSync(join(path, "gen.py")));
            assert.ok(existsSync(join(path, "brute.cpp")));
        });
    });

    test("Parse Test Cases", function () {
        let path = join(CONTEST, 'A');
        let result = testCasesName(path);
        let target = ["0", "1", "2"];

        assert.equal(result.length, target.length);
        result.sort();

        for (let i = 0; i < 3; ++i) {
            assert.equal(target[i], result[i]);
        }
    });

    test("Create new problem from id", function () {
        runWithTemporaryPath((path: string) => {
            let problemId = "mockProblem";
            newProblemFromId(path, MOCK_SITE, problemId);
            let problemPath = join(path, problemId);
            assert.ok(existsSync(problemPath));
            assert.ok(existsSync(join(problemPath, 'sol.cpp')));
            assert.ok(existsSync(join(problemPath, ATTIC)));
            assert.ok(existsSync(join(problemPath, TESTCASES)));
            assert.equal(readdirSync(join(problemPath, TESTCASES)).length, 6, "Incorrect number of files.");
        });
    });

    test("Timed run OK", function () {
        this.timeout(20000);
        testResult("A", Verdict.OK, 10000);
    });

    test("Timed run WA", function () {
        this.timeout(20000);
        testResult("B", Verdict.WA, 10000);
    });

    test("Timed run RTE", function () {
        this.timeout(20000);
        testResult("C", Verdict.RTE, 10000);
    });

    test("Timed run TLE", function () {
        this.timeout(20000);
        testResult("D", Verdict.TLE, 2000);
    });
});

function testResult(problemId: string, expectedResult: Verdict, timeLimit: number) {
    runWithTemporaryPath((globalPath: string) => {
        initAcmX(globalPath);
        let problem = join(CONTEST, problemId);

        runWithCopiedFolder(problem, (path: string) => {
            copyFileSync(join(globalAtticPath(globalPath), 'checkers', 'wcmp.exe'), join(path, ATTIC, 'checker.exe'));
            let testCaseId = '0';
            compileCode(join(path, 'sol.cpp'), join(path, ATTIC, 'sol.exe'));
            let result: TestCaseResult = timedRun(path, testCaseId, timeLimit);
            assert.equal(result.status, expectedResult);
        });
    });
}