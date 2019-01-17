# List of TODO

* **WOW** Use this tool: [caide-cpp-inliner](https://github.com/slycelote/caide-cpp-inliner). Suggestion from jcg. Also find https://github.com/slycelote/caide
* When a new view is activated (after run or view:code) close all open tabs. (also (maybe) collapse everything not related to the problem)
* Implement parser for codeforces-gym/codechef/atcoder/matcomgrader/coj (which are most popular online judges currently)

* [005](/src/core.ts): Restrict brute in time, and capture errors
  * Allow stopping a running program (such as sol.cpp/brute.cpp/gen.py/etc...)
* [007](/src/extension.ts): How can I have access to new proccess created using `openFolder`?

## QUICK TODO

* Use better names for single problems.
* Test add problem/add contest with codeforces problems (mostly folder and names where are created)
* Test and provide example using other languages.
* Copy to clipboard (smart copy in the future with tool suggested by jcg) (Find in examples, create shortcut)

## Settings

Particular settings (per problem) configuration on current workspace.
This can be done creating such configurations globally and udpating them per workspace (only problem here is that in one workspace might coexist several programs so best answer is probably creating a config file inside each problem and access them through cool UI settings provided by VSCode. This can be done since GitLens already do that.) Store also problem name on this config file, maybe URL.

* Make a new command to open particular settings of a problem

* [ ] Checker
  * [ ] Allow custom checker implemented with testlib.
  * [ ] Try to figure out correct checker.
  * [ ] Create few cool checkers such as only first token or accept everything.
* [ ] Allow multiple solutions. (Don't check on this case. Try to figure out if this is the case)
* [ ] Is interactive (Don't check on this case. Try to figure out if this is the case)
