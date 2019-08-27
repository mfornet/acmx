# ACMX

**acmX** is tool that empower contestants to solve competitive programming problems easily.

## Features

* Contest/Problem parsing. (Through [Competitive-Companion)](https://github.com/jmerle/competitive-companion) extension.)
* Running solution against testcases automatically
* Add custom testcases easily
* Veredict reporting (OK, WA, RTE, TLE, CE)
* Smart generator creation. Testcases generator is created using `tcgen` program synthesis tool by inspecting testcases.
* Stressing solution against brute using a generator (Useful to find corner cases)
* (WIP) Automatic generator creation from inputs/outputs structure

## Join the conversation

We have a group to discuss about this tool in Telegram. [Join here](https://t.me/acm_x).

## How am I supposed to use **acmX**

**acmX** have been designed to run automatically boilerplate actions [I](https://codeforces.com/profile/marX) repeat often in competitive programming. Next is the expected pipeline to interact with it. It is important that you [setup some configurations](#getting-started) before start using the tool.

* Open Visual Studio Code

* Open online contest/problem you want to solve and click on competitive-companion extension button. All problems along with the testcases are downloaded and you are ready to code.

* Start coding awesome solution inside file `sol.cpp`.

* After you finish call `Run` and automatically your program will be compiled and run against every testcases. If the solutions is ok, it will be reported otherwise you will see failing testcase in a *cool layout*. You can always go back to original layout calling `View: Code`.

* Add more testcases than provided in statement using `Add Test Case`, or modify and see existing testcases by calling `Open Test Case`.

* If your solution keep failing you can stress it using a generator and a brute solution. Call `Upgrage` to create both generator (`gen.py`) and correct (`brute.cpp`) programs. Right now generator must be written in python. After both codes are ready call `Stress` and your original code will be tested on random test cases from generator against correct solution.

The environment structure is the following:

```file
    round-525/
        A/
            sol.cpp
            brute.cpp
            gen.py
            attic/...
            testcases/
                1.in
                1.out
                1.real
                ...
        B/...
        C/...
        D/...
        E/...
```

Certainly **acmX** can be (and hopefully will be) extended so that it fits everyones pipeline. If **acmX** almost fit yours, feel free to improve it and make a PR! I'll be happy to hear from you and give you support. If you find any issue report it at [github issue tracker](https://github.com/mfornet/acmx/issues).

## Getting started

You need to tell **acmX** which folder are you going to use to save all the problems and contests. To do that:

* Open settings (from command palette) or `Ctrl+,`
* Go to `acmx.configuration.solutionPath`
* Set this value to the path you are going to use for storing contests and problems. (e.g. `/path/to/my/solutions`)

Parsing problems and contests is done via [Competitive-Companion](https://github.com/jmerle/competitive-companion) extension. To use it with `acmX`:

* Install the extension for your browser:
  * [Chrome](https://chrome.google.com/webstore/detail/competitive-companion/cjnmckjndlpiamhfimnnjmnckgghkjbl)
  * [Firefox](https://addons.mozilla.org/en-US/firefox/addon/competitive-companion/)
* [Change the port used by the extension](https://github.com/jmerle/competitive-companion#custom-tools) to 10042. This is the port used by default in `acmX`. If you want to use any other port, open settings and update `acmx.companion.port`. This require to reset vscode to take effect. You should also change the port on the extension.

I encourage everyone to read and change [all settings](#settings) before first use. Anyway, after updating `acmx.configuration.solutionPath` it should work good for C++ users.

## How does stressing the solution work

To stress the solution your code is compared to a correct code against a larga sample of testcases. In order to do that you should execute `ACMX: Upgrade` from the command pallete. Two files will be created.

* `brute.cpp` This should be a correct solution. A code that is expected to report correct output. It doesn't matter if it's slow as long as you only check this program against small testcases.
* `gen.py` Every time this code is executed is expected to print a random testcases.

**AWESOME** `gen.py` is created automatically by inspecting testcases if you install [`tcgen`](https://github.com/mfornet/tcgen).
To install `tcgen` just run:

`pip install tcgen`

## Default template is awful, how can I change it

Create a file with your template. In settings, set `acmx.configuration.templatePath` to the path to your template.

## I code in java, can I use this tool

Yes, of course, and any other language you want. Just make sure to update your [language configuration](doc/languages.md) setting.

## This problem has multiple correct answers, what can I do

Set checker properly for this problemm via **ACMX: Set Checker**. Checkers can use [testlib.h](https://github.com/MikeMirzayanov/testlib) which is recommended.

## Commands

Call this commands from the command pallete (`Ctrl + Shift + P`).

* acmx.addProblem (**ACMX: New Problem**): Create a new problem. Make environment skeleton and download testcases.
* acmx.addContest (**ACMX: New Contest**): Create a new contest. Make environment skeleton and download testcases.
* acmx.runSolution (**ACMX: Run**): Compile and run current solution against testcases.
* acmx.openTestcase (**ACMX: Open Test Case**): Open a paticular testcase.
* acmx.addTestcase (**ACMX: Add Test Case**): Add a new testcase.
* acmx.coding (**ACMX: View: Code**): Return to 1 column layout (better to code).
* acmx.stress (**ACMX: Stress**): Run the solution against correct program using testcases from generator. Useful to find failing and corner cases. Must call upgrade first.
* acmx.setChecker (**ACMX: Set Checker**): Create checker file. Allow to select a checker among a pool of custom checkers.
* acmx.upgrade (**ACMX: Upgrade**): Create aditionals files before calling `Stress`.
* acmx.compile (**ACMX: Compile**): Compile `sol.cpp`.

## Settings

* **acmx.configuration.templatePath**: Path to template file. Leave empty to use default template.
* **acmx.configuration.solutionPath**: Path to folder where contest will be created and stored. To set active workspace use `.`
* **acmx.configuration.extension**: Extension of the programming language you will use to code solutions. Default `cpp` for c++
* **acmx.run.timetimeLimit**: Maximum time limit in seconds to run the program on each test case.
* **acmx.execution.compile**: Command to compile C++ programs. Refer to the code as $PROGRAM, and output file as $OUTPUT.
* **acmx.execution.pythonPath**: Path to python executable. This will be used to run generator.
* **acmx.stress.times**: Number of times to run solution on random generated test cases against
  brute solution.
