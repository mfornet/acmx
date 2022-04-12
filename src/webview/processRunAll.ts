import { Problem } from "./types";
import { runSingleAndSave, emit_fail } from "./processRunSingle";
import { getJudgeViewProvider } from "../extension";
import { sleep } from "../utils";
/**
 * Run every testcase in a problem one by one. Waits for the first to complete
 * before running next. `runSingleAndSave` takes care of saving.
 **/
export default async (problem: Problem) => {
    console.log("Run all started", problem);

    const wait = getJudgeViewProvider().isViewVisible();
    await getJudgeViewProvider().focus();
    if (wait !== true) {
        // give enough time to load, otherwise result of first testcase may be lost
        await sleep(1000);
    }

    let ok = true;
    for (const testCase of problem.tests) {
        if (!ok) {
            emit_fail(problem, testCase.id);
            continue;
        }
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: "running",
            id: testCase.id,
            problem: problem,
        });
        if (!(await runSingleAndSave(problem, testCase.id))) {
            ok = false;
        }
    }
    console.log("Run all finished");
};
