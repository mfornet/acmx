import { join } from 'path';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { TESTCASES } from '../../primitives';
import { currentProblem, testCasesName } from '../../core';
import {
    WebviewToVSEvent,
    TestCase,
    Case,
    VSToWebViewMessage,
    ResultCommand,
    RunningCommand,
} from '../types';
import CaseView from './CaseView';
import { writeToFileSync } from '../../utils';
import { readFileSync, existsSync } from 'fs';

let tcCount = 0;

declare const vscodeApi: {
    postMessage: (message: WebviewToVSEvent) => void;
};

function Judge(props: {
    cases: Case[];
    updateCases: (cases: Case[]) => void;
}) {
    const cases = props.cases;
    const updateCases = props.updateCases;

    console.log('new cases:', cases);

    const [focusLast, useFocusLast] = useState<boolean>(false);
    const [forceRunning, useForceRunning] = useState<string | false>(false);
    const [compiling, setCompiling] = useState<boolean>(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [waitingForSubmit, setWaitingForSubmit] = useState<boolean>(false);

    useEffect(() => {
        console.log('Adding event listeners');
        const fn = (event: any) => {
            const data: VSToWebViewMessage = event.data;
            console.log('Got event in web view', event.data);
            switch (data.command) {
                case 'new-problem': {
                    break;
                }

                case 'running': {
                    handleRunning(data);
                    break;
                }
                case 'run-all': {
                    runAll();
                    break;
                }
                case 'compiling-start': {
                    setCompiling(true);
                    break;
                }
                case 'compiling-stop': {
                    setCompiling(false);
                    break;
                }
                case 'submit-finished': {
                    setWaitingForSubmit(false);
                    break;
                }
                case 'waiting-for-submit': {
                    setWaitingForSubmit(true);
                    break;
                }
                default: {
                    console.log('Invalid event', event.data);
                }
            }
        };
        window.addEventListener('message', fn);
        return () => {
            console.log('Cleaned up event listeners');
            window.removeEventListener('message', fn);
        };
    }, []);

    const handleRunning = (data: RunningCommand) => {
        useForceRunning(data.tcName);
    };

    const rerun = (tcName: string, input: string, output: string) => {
        let path_ = currentProblem();
        let path = path_.unwrap();
        let tcInput = join(path, TESTCASES, `${tcName}.in`);
        let tcOutput = join(path, TESTCASES, `${tcName}.ans`);

        if (!existsSync(tcInput)) {
            console.log('No tcName in problem tests', tcName);
            return;
        }

        writeToFileSync(tcInput, input);
        writeToFileSync(tcOutput, output);

        vscodeApi.postMessage({
            command: 'run-single-and-save',
            tcName,
        });
    };

    // Remove a case.
    const remove = (tcName: string) => {
        const newCases = cases.filter((value) => value.tcName !== tcName);
        updateCases(newCases);
    };

    // Create a new Case
    const newCase = () => {
        console.log(cases);
        tcCount = tcCount + 1;
        const tcName = 'ui' + tcCount.toString();
        const testCase: TestCase = {
            tcName,
            input: '',
            output: '',
        };
        updateCases([
            ...cases,
            {
                tcName,
                result: null,
                testcase: testCase,
            },
        ]);
        useFocusLast(true);
    };

    // Stop running executions.
    const stop = () => {
        vscodeApi.postMessage({
            command: 'kill-running',
        });
    };

    // Deletes the .prob file and closes webview
    const deleteTcs = () => {
        vscodeApi.postMessage({
            command: 'delete-tcs',
        });
    };

    const runAll = () => {
        vscodeApi.postMessage({
            command: 'run-all-and-save',
        });
    };

    const submitCf = () => {
        vscodeApi.postMessage({
            command: 'submitCf',
        });

        setWaitingForSubmit(true);
    };

    const debounceFocusLast = () => {
        setTimeout(() => {
            useFocusLast(false);
        }, 100);
    };

    const debounceForceRunning = () => {
        setTimeout(() => {
            useForceRunning(false);
        }, 100);
    };

    const getRunningProp = (value: Case) => {
        if (forceRunning === value.tcName) {
            console.log('Forcing Running');
            debounceForceRunning();
            return forceRunning === value.tcName;
        }
        return false;
    };

    const updateCase = (tcName: string, input: string, output: string) => {
        const newCases: Case[] = cases.map((testCase) => {
            if (testCase.tcName === tcName) {
                return {
                    tcName,
                    result: testCase.result,
                    testcase: {
                        tcName,
                        input,
                        output,
                    },
                };
            } else {
                return testCase;
            }
        });
        updateCases(newCases);
    };

    const notify = (text: string) => {
        setNotification(text);
        setTimeout(() => {
            setNotification(null);
        }, 1000);
    };

    const views: JSX.Element[] = [];
    cases.forEach((value, index) => {
        if (focusLast && index === cases.length - 1) {
            views.push(
                <CaseView
                    notify={notify}
                    // num={index + 1}
                    case={value}
                    rerun={rerun}
                    key={value.tcName.toString()}
                    remove={remove}
                    doFocus={true}
                    forceRunning={getRunningProp(value)}
                    updateCase={updateCase}
                ></CaseView>,
            );
            debounceFocusLast();
        } else {
            views.push(
                <CaseView
                    notify={notify}
                    // num={index + 1}
                    case={value}
                    rerun={rerun}
                    key={value.tcName.toString()}
                    remove={remove}
                    forceRunning={getRunningProp(value)}
                    updateCase={updateCase}
                ></CaseView>,
            );
        }
    });

    const renderSubmitButton = () => {
        // let url: URL;
        // try {
        //     url = new URL(problem.url);
        // } catch (err) {
        //     console.error(err);
        //     return null;
        // }
        // if (
        //     url.hostname !== 'codeforces.com' &&
        //     url.hostname !== 'open.kattis.com'
        // ) {
        //     return null;
        // }

        // if (url.hostname == 'codeforces.com') {
            return (
                <button className="btn" onClick={submitCf}>
                    Submit to Codeforces
                </button>
            );
        // } else if (url.hostname == 'open.kattis.com') {
        //     return (
        //         <div className="pad-10 submit-area">
        //             <button className="btn" onClick={submitKattis}>
        //                 Submit on Kattis
        //             </button>
        //             {waitingForSubmit && (
        //                 <>
        //                     <span className="loader"></span> Submitting...
        //                     <br />
        //                     <small>
        //                         To submit to Kattis, you need to have the{' '}
        //                         <a href="https://github.com/Kattis/kattis-cli/blob/master/submit.py">
        //                             submission client{' '}
        //                         </a>
        //                         and the{' '}
        //                         <a href="https://open.kattis.com/download/kattisrc">
        //                             configuration file{' '}
        //                         </a>
        //                         downloaded in a folder called .kattis in your
        //                         home directory.
        //                         <br />
        //                         Submission result will open in your browser.
        //                         <br />
        //                         <br />
        //                     </small>
        //                 </>
        //             )}
        //         </div>
        //     );
        // }
    };

    const getHref = () => {
        // if (problem.local === undefined || problem.local === false) {
        //     return problem.url;
        // } else {
            return undefined;
        // }
    };

    return (
        <div className="ui">
            {notification && <div className="notification">{notification}</div>}
            <div className="meta">
                <h1 className="problem-name">
                    <a href={getHref()}>{'Find my name dummy'}</a>{' '}
                    {compiling && (
                        <b className="compiling" title="Compiling">
                            <span className="loader"></span>
                        </b>
                    )}
                </h1>
            </div>
            <div className="results">{views}</div>
            <div className="margin-10">
                <button
                    className="btn btn-green"
                    onClick={newCase}
                    title="Create a new empty testcase"
                >
                    + New Testcase
                </button>
                {/* <span onClick={toggleOnlineJudgeEnv}>
                    <input type="checkbox" checked={onlineJudgeEnv} />
                    <span>
                        Set <code>ONLINE_JUDGE</code>
                    </span>
                </span> */}
                {renderSubmitButton()}
            </div>

            <div className="actions">
                <button
                    className="btn"
                    onClick={runAll}
                    title="Run all testcases again"
                >
                    ↺ Run All
                </button>
                <button
                    className="btn btn-green"
                    onClick={newCase}
                    title="Create a new empty testcase"
                >
                    + New
                </button>
                <button
                    className="btn btn-orange"
                    onClick={stop}
                    title="Kill all running testcases"
                >
                    ⊗ Stop
                </button>
                <a
                    className="btn"
                    title="Help"
                    href="https://github.com/agrawal-d/cph/blob/master/docs/user-guide.md"
                >
                    ?
                </a>
                <button
                    className="btn btn-red right"
                    onClick={deleteTcs}
                    title="Delete all testcases and close results window"
                >
                    ☠ Delete
                </button>
            </div>

            {waitingForSubmit && (
                <div className="margin-10">
                    <span className="loader"></span> Waiting for extension ...
                    <br />
                    <small>
                        To submit to codeforces, you need to have the{' '}
                        <a href="https://github.com/agrawal-d/cph-submit">
                            cph-submit browser extension{' '}
                        </a>
                        installed, and a browser window open. You can change
                        change language ID from VS Code settings.
                        <br />
                        <br />
                        Hint: You can also press <kbd>Ctrl+Alt+S</kbd> to
                        submit.
                    </small>
                </div>
            )}
        </div>
    );
}

const getCasesFromProblem = (): Case[] => {
    let path_ = currentProblem();

    if (path_.isNone()) {
        return [];
    }

    let path = path_.unwrap();
    let tests = testCasesName(path);

    return tests.map((tcName) => ({
        tcName: tcName,
        result: null,
        testcase: {
            input: readFileSync(join(path, TESTCASES, `${tcName}.in`, "utf8")).toString(),
            output: readFileSync(join(path, TESTCASES, `${tcName}.ans`, "utf8")).toString(),
            tcName: tcName,
        },
    }));
};

/**
 * A wrapper over the main component Judge.
 * Shows UI to create problem when no problem exists.
 * Otherwise, shows the Judge view.
 */
function App() {
    // const [problem, setProblem] = useState<Problem | undefined>(undefined);
    const [cases, setCases] = useState<Case[]>([]);
    // const [deferSaveTimer, setDeferSaveTimer] = useState<number | null>(null);
    // const [, setSaving] = useState<boolean>(false);
    const [showFallback, setShowFallback] = useState<boolean>(false);

    // Save the problem
    // const save = () => {
        // setSaving(true);
        // if (problem !== undefined) {
        //     console.log('Saved problem');
        //     vscodeApi.postMessage({
        //         command: 'save',
        //         problem,
        //     });
        // }
        // setTimeout(() => {
        //     setSaving(false);
        // }, 500);
    // };

    const handleRunSingleResult = (data: ResultCommand) => {
        const idx = cases.findIndex(
            (testCase) => testCase.tcName === data.result.tcName,
        );
        if (idx === -1) {
            console.error('Invalid single result', cases, cases.length, data);
            return;
        }
        const newCases = cases.slice();
        newCases[idx].result = data.result;
        console.log('single result', data);
        setCases(newCases);
    };

    // Save problem if it changes.
    // useEffect(() => {
    //     if (deferSaveTimer !== null) {
    //         clearTimeout(deferSaveTimer);
    //     }
    //     const timeOutId = window.setTimeout(() => {
    //         setDeferSaveTimer(null);
    //         save();
    //     }, 500);
    //     setDeferSaveTimer(timeOutId);
    // }, [problem]);

    useEffect(() => {
        console.log('Adding event listeners for App');
        const fn = (event: any) => {
            const data: VSToWebViewMessage = event.data;
            switch (data.command) {
                case 'new-problem': {
                    let path_ = currentProblem();

                    if (path_.isNone()) {
                        setShowFallback(true);
                    }

                    // setProblem(data.problem);
                    setCases(getCasesFromProblem());
                    break;
                }
                case 'run-single-result': {
                    handleRunSingleResult(data);
                    break;
                }
            }
        };
        window.addEventListener('message', fn);
        return () => {
            console.log('Cleaned up event listeners for App');
            window.removeEventListener('message', fn);
        };
    }, [cases]);

    const createProblem = () => {
        vscodeApi.postMessage({
            command: 'create-local-problem',
        });
    };

    let path_ = currentProblem();
    if (path_.isNone() && showFallback) {
        return (
            <div className="ui p10">
                <div className="text-center">
                    <p>
                        This document does not have a CPH problem associated
                        with it.
                    </p>
                    <br />
                    <div className="btn btn-block" onClick={createProblem}>
                        + Create Problem
                    </div>
                    <a
                        className="btn btn-block btn-green"
                        href="https://github.com/agrawal-d/cph/blob/master/docs/user-guide.md"
                    >
                        How to use this extension
                    </a>
                </div>
            </div>
        );
    } else if (!path_.isNone()) {
        return (
            <Judge
                // problem={problem}
                // updateProblem={setProblem}
                cases={cases}
                updateCases={setCases}
            />
        );
    } else {
        return (
            <>
                <div className="text-center">Loading...</div>
            </>
        );
    }
}

ReactDOM.render(<App />, document.getElementById('app'));
