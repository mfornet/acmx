# List of TODO

* **WOW** Use this tool: [caide-cpp-inliner](https://github.com/slycelote/caide-cpp-inliner). Suggestion from jcg
* When a new view is activated (after run or view:code) close all open tabs. (also (maybe) collapse everything not related to the problem)
* Allow programming in other languages than c++ (easy now)
* Implement parser for codeforces-gym/codechef/atcoder/matcomgrader/coj (which are most popular online judges currently)
* TODO: Test add problem/add contest with codeforces problems (mostly folder and names where are created)

* [005](/src/core.ts): Restrict brute in time, and capture errors
  * Allow stopping a running program (such as sol.cpp/brute.cpp/gen.py/etc...)
* [007](/src/extension.ts): How can I have access to new proccess created using `openFolder`?

## QUICK TODO


* Update README to support multiple languages (only that need to be properly setted is compilation line. Even python is accepted) User need to provide line that take $PROGRAM file and makes and executable at $OUTPUT (this can be anything). Make an example of how to do that for python and maybe other languages. This would be good as a separate minitutorial linked here
* Move minitutorials to doc folder and write a minitutorial on what is contest-id problem-id etc on each platform to avoid doubts

* On README First steps:
  * Folder to store contests
  * Compilation line (in sevaral languages linking minitutorial)
  * Path to template

* Copy to clipboard (smart copy in the future with tool suggested by jcg) (Find in examples, create shortcut)
* Create shortcut to Run/Stress/Compile/etc...

## Settings

Global settings

* [x] Time Limit
* [X] Template file
* [X] Line to execute C++ (Upgrade this line, by increasing stack and making optimizations by default)
* [X] Line to execute Python

Particular settings (per problem) configuration on current workspace.
This can be done creating such configurations globally and udpating them per workspace (only problem here is that in one workspace might coexist several programs so best answer is probably creating a config file inside each problem and access them through cool UI settings provided by VSCode. This can be done since GitLens already do that.) Store also problem name on this config file, maybe URL.

* Make a new command to open particular settings of a problem

* [ ] Checker
  * [ ] Allow custom checker implemented with testlib.
  * [ ] Try to figure out correct checker.
  * [ ] Create few cool checkers such as only first token or accept everything.
* [ ] Allow multiple solutions. (Don't check on this case. Try to figure out if this is the case)
* [ ] Is interactive (Don't check on this case. Try to figure out if this is the case)
