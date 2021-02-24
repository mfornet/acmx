import { Problem } from './types';
import { runSingleAndSave, emit_fail } from './processRunSingle';
import { getJudgeViewProvider } from '../extension';

/**
 * Run every testcase in a problem one by one. Waits for the first to complete
 * before running next. `runSingleAndSave` takes care of saving.
 **/
export default async (problem: Problem) => {
    console.log('Run all started', problem);
    
    let ok = true;
    for (const testCase of problem.tests) {
        if (!ok) {
            emit_fail(problem, testCase.id);
            continue;
        }
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: 'running',
            id: testCase.id,
            problem: problem,
        });
        if (!await runSingleAndSave(problem, testCase.id)) {
            ok = false;
        }
    }
    console.log('Run all finished');
};
