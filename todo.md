# List of TODO

* **IMPORTANT** Add How to Use (in the README.) How to add own template etc...
* **WOW** Use this tool: [caide-cpp-inliner](https://github.com/slycelote/caide-cpp-inliner).  Suggestion from jcg
* When a new view is activated (after run or view:code) close all open tabs. (also (maybe) collapse everything not related to the problem)
* Allow programming in other languages than c++

* [005](/src/core.ts): Restrict brute in time, and capture errors
  * Allow stopping a running program (such as sol.cpp/brute.cpp/gen.py/etc...)
* [007](/src/extension.ts): How can I have access to new proccess created using `openFolder`?

## Settings

Global settings

* [x] Time Limit
* [X] Template file
* [X] Line to execute C++ (Upgrade this line, by increasing stack and making optimizations by default)
* [X] Line to execute Python

Particular settings (per problem)

* [ ] Checker
  * [ ] Allow custom checker implemented with testlib.
  * [ ] Try to figure out correct checker.
* [ ] Allow multiple solutions. (Don't check on this case. Try to figure out if this is the case)
* [ ] Is interactive (Don't check on this case. Try to figure out if this is the case)