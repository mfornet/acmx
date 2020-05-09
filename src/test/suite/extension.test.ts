import * as assert from "assert";

import * as vscode from "vscode";
import {
    newArena,
    upgradeArena,
    pathToStatic,
    testCasesName,
    newProblemFromId,
} from "../../core";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { runWithTemporaryPath, MOCK_SITE } from "../testUtils";
import { ATTIC, TESTCASES } from "../../primitives";

const CONTEST = join(pathToStatic(), "testData", "exampleContest");

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
        this.timeout(5000);

        runWithTemporaryPath((path: string) => {
            newArena(path);
            upgradeArena(path);

            assert.ok(existsSync(join(path, "gen.py")));
            assert.ok(existsSync(join(path, "brute.cpp")));
        });
    });

    test("Parse Test Cases", function () {
        let path = join(CONTEST, "A");
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
            assert.ok(existsSync(join(problemPath, "sol.cpp")));
            assert.ok(existsSync(join(problemPath, ATTIC)));
            assert.ok(existsSync(join(problemPath, TESTCASES)));
            assert.equal(
                readdirSync(join(problemPath, TESTCASES)).length,
                6,
                "Incorrect number of files."
            );
        });
    });
});
