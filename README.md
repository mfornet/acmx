# ACMX

[![Build Status](https://img.shields.io/github/workflow/status/mfornet/acmx/vscode-ext-test)](https://img.shields.io/github/workflow/status/mfornet/acmx/vscode-ext-test) ![Visual Studio Marketplace Installs(https://marketplace.visualstudio.com/items?itemName=marx24.acmx)](https://img.shields.io/visual-studio-marketplace/i/marx24.acmx) [![](images/telegram-badge.png)](https://t.me/acm_x)

**acmX** is tool that empower contestants to solve competitive programming problems easily.

## Features

* Contest/Problem parsing. (Via [Competitive-Companion](https://github.com/jmerle/competitive-companion) extension).
* Running solution against testcases.
* Automatic verdict results (OK, WA, RTE, TLE, CE).
* Manage testcases easily.
* Stressing solution against brute solution using a generator (Useful to find corner cases).
* Support for multiple languages.

## Join the conversation

We have a group to discuss about this tool in [Telegram](https://t.me/acm_x).

## Getting started

**acmX** have been designed to run automatically boilerplate actions repeated often in competitive programming. Next is the expected pipeline to interact with it.

![Getting started](images/getting-started.gif)

1. Open online contest/problem you want to solve and parse with competitive-companion extension. All problems along with the testcases are downloaded and you are ready to code.

2. Work on your solution on `sol.cpp`.

3. After you finish call `Run` and automatically your program will be compiled and run against every testcases. If the solutions is correct, it will be reported as `Ok` otherwise you will see failing test case. You can always go back to original layout calling `View: Code`.

Certainly **acmX** can be (and hopefully will be) extended so that it fits everyone pipeline. If **acmX** almost fit yours, feel free to make a suggestion or improve it your self! I'll be happy to hear from you and give you support. If you find any issue report it at [github issue tracker](https://github.com/mfornet/acmx/issues).

## Features and settings

Check out all features and settings in [the wiki](https://github.com/mfornet/acmx/wiki).
