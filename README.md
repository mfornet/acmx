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

**acmX** have been designed to run automatically boilerplate actions [I](https://codeforces.com/profile/marX) repeat often in competitive programming. This is the expected pipeline to interact with it.

* Create a contest calling `New Contest` or maybe a single problem calling `New Problem`. Testcases are downloaded automatically :)

* Start coding awesome solution inside file `sol.cpp`. Right now solutions are only available in C++.

* After you finish the code call `Run` and automatically your program will be compiled and run against every testcases. If the solutions seems to be ok, it will be reported otherwise you will see failing testcase in a *cool layout*. You can always go back to original layout calling `View: Code`.

* Add more testcases than provided in statement using `Add Test Case`, or modify and see existing testcases by calling `Open Test Case`.

* If your solution keep failing you can stress it using a generator and a brute solution. Call `Upgrage` to create both generator (`attic/gen.py`) and correct (`brute.cpp`) programs. Right now generator must be written in python, and correct program must be written in C++. After both codes are ready just call `Stress` and your original code will be tested on random test cases from generator against correct solution.

The environment structure is the following:

```file
    contest/
        problemA/
            sol.cpp
            brute.cpp
            attic/
                sol
                brout
                gen.py
            testcases/
                1.in
                1.out
                1.real
                ...
        problemB/...
        problemC/...
        problemD/...
        problemE/...
```

Certainly **acmX** can be (and hopefully will be) extended so that it fits everyones pipeline. If **acmX** almost fit yours, feel free to improve it and make a PR! I'll be happy to hear from you and give you support.

## Default template is awful, how can I change it

Create a file with your template. In settings change `acmx.configuration.templatePath` to the path of your templates file.

## Commands

* acmx.addProblem (**New Problem**):
* acmx.addContest (**New Contest**):
* acmx.runSolution (**Run**):
* acmx.openTestcase (**Open Test Case**):
* acmx.addTestcase (**Add Test Case**):
* acmx.coding (**View: Code**):
* acmx.stress (**Stress**):
* acmx.upgrade (**Upgrade**):
* acmx.compile (**Compile**):

## Settings

* **acmx.configuration.templatePath**: Path to template file. Leave empty to use default template.
* **acmx.run.timetimeLimit**: Maximum time limit in seconds to run the program on each test case.
* **acmx.execution.compileCpp**: Command to compile C++ programs. Refer to the code as $PROGRAM, and output file as $OUTPUT.
* **acmx.execution.pythonPath**: Path to python executable. This will be used to run generator.
