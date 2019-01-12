# ACMX

**acmX** is tool that empower contestants to solve competitive programming problems easily.

## Features

* Contest/Problem parsing. Current sites supported:
  * [Codeforces](http://codeforces.com)
* Running solution against testcases automatically
* Add custom testcases easily
* Smart veredict reporting (OK, WA, RTE, TLE, CE)
* Stressing solution against brute using a generator (Useful to find corner cases)
* (WIP) Automatic generator creation from inputs/outputs structure

## How am I supposed to use **acmX**

**acmX** have been designed to run automatically boilerplate actions [I](https://codeforces.com/profile/marX) repeat often in competitive programming. Next is the expected pipeline to interact with it. It is important that you [setup some configurations](#getting-started) before start using the tool.

* Create a contest calling `New Contest` or maybe a single problem calling `New Problem`. Testcases are downloaded automatically :)

* Start coding awesome solution inside file `sol.cpp`.

* After you finish the code call `Run` and automatically your program will be compiled and run against every testcases. If the solutions seems to be ok, it will be reported otherwise you will see failing testcase in a *cool layout*. You can always go back to original layout calling `View: Code`.

* Add more testcases than provided in statement using `Add Test Case`, or modify and see existing testcases by calling `Open Test Case`.

* If your solution keep failing you can stress it using a generator and a brute solution. Call `Upgrage` to create both generator (`gen.py`) and correct (`brute.cpp`) programs. Right now generator must be written in python, and correct program must be written in C++. After both codes are ready just call `Stress` and your original code will be tested on random test cases from generator against correct solution.

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

You need to tell **acmX** which folder are you going to use, to save all the problems and contests. To do that:

* Open settings (from command palette) or `Ctrl+,`
* Go to `acmx.configuration.solutionPath`
* Set this value to the path you are going to use to store contests and problems. (e.g. `/path/to/my/solutions`)

I encourage everyone to read and change [all settings](#settings) so you can customize **acmX** for you. Anyway, after updating `acmx.configuration.solutionPath` it should work good for C++ users.

## Default template is awful, how can I change it

Create a file with your template. In settings change `acmx.configuration.templatePath` to the path of your templates file.

## What is contest id on each platform

You can find this information for every supported platform [here](doc/platforms-id.md).

## I code in java, can I use this tool

Yes, of course, and any other language you want. Just make sure to update your [language configuration](doc/languages.md) setting.

## Commands

Call this commands from the command pallete (`Ctrl + Shift + P`).

* acmx.addProblem (**ACMX: New Problem**): Create a new problem. Make environment skeleton and download testcases.
* acmx.addContest (**ACMX: New Contest**): Create a new contest. Make environment skeleton and download testcases.
* acmx.runSolution (**ACMX: Run**): Compile and run current solution against testcases.
* acmx.openTestcase (**ACMX: Open Test Case**): Open a paticular testcase.
* acmx.addTestcase (**ACMX: Add Test Case**): Add a new testcase.
* acmx.coding (**ACMX: View: Code**): Return to 1 column layout (better to code).
* acmx.stress (**ACMX: Stress**): Run the solution against correct program using testcases from generator. Useful to find failing and corner cases. Must call upgrade first.
* acmx.upgrade (**ACMX: Upgrade**): Create aditionals files before calling `Stress`
* acmx.compile (**ACMX: Compile**): Compile `sol.cpp`.

## Settings

* **acmx.configuration.templatePath**: Path to template file. Leave empty to use default template.
* **acmx.configuration.solutionPath**: Path to folder where contest will be created and stored. To set active workspace use `.`
* **acmx.configuration.extension**: Extension of the programming language you will use to code solutions. Default `cpp` for c++
* **acmx.run.timetimeLimit**: Maximum time limit in seconds to run the program on each test case.
* **acmx.execution.compile**: Command to compile C++ programs. Refer to the code as $PROGRAM, and output file as $OUTPUT.
* **acmx.execution.pythonPath**: Path to python executable. This will be used to run generator.
