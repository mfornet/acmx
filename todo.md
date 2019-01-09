# List of TODO

* Use this tool: https://github.com/slycelote/caide-cpp-inliner.  Suggestion from jcg
* Add How to Use (in the README.) How to add own template etc...
* **NEXT** Create custom settings. Add (TimeLimit, Checker)
* **IMPORTANT** When a new view is activated (after run or view:code) close all open tabs. (also (maybe) collapse everything not related to the problem)
* Implement parser for codeforces to test on real cases
* **INTERNET** Learn how to move static files from `src` to `out`. Make this extension works.
* Allow programming in other languages than c++
* Figure out something for interactive problems.
* Allow stopping a running program (such as sol.cpp/brute.cpp/gen.py/etc...)
* Allow custom checker easily
* Add several checkers and try to infer which is the correct!
* Fix name of new problems after calling addProblem
* Add Compile command

* [001](/src/core.ts): Revisit this constant. Show specific error to know when this is an issue. Add in settings
* [002](/src/core.ts): Avoid this hardcoded line. Use personalized compile line. increase stack by default. This involve allowing different languages
* [004](/src/core.ts): Make crossplatform call. Solution: Configure path to python in global settings
* [005](/src/core.ts): Restrict brute in time, and capture errors
* [006](/src/extension.ts): **PARSING** Provide custom problem and contest id example in placeholder per different site
* [007](/src/extension.ts): How can I have access to new proccess created using `openFolder`?
