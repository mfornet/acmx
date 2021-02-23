import { Problem } from './types';
import { runSingleAndSave } from './processRunSingle';
import { getJudgeViewProvider } from '../extension';

/**
 * Run every testcase in a problem one by one. Waits for the first to complete
 * before running next. `runSingleAndSave` takes care of saving.
 **/
export default async (problem: Problem) => {
    console.log('Run all started', problem);
    
    for (const testCase of problem.tests) {
        getJudgeViewProvider().extensionToJudgeViewMessage({
            command: 'running',
            id: testCase.id,
            problem: problem,
        });
        if (!await runSingleAndSave(problem, testCase.id)) {
            break;
        }
    }
    console.log('Run all finished');
};
