# Change Log

Notable updates of **acmX**

## 0.2.8

* Show diff on failing test cases #47 (thanks Salil03)
* Show compilation error on editor #47 (thanks @Salil03)
* Specify number of problem of a contest using the character from the last problem. (J for 10)
* Save before compiling and running #15
* Fix some issues #19, #26, #50
* Improve contributing experience

## 0.2.7

* Fix bugs introduced after features in 0.2.6

## 0.2.6

* Add official logo (thanks @Salil03)
* Allow default launch.json and tasks.json
* Allow select testcase to debug (only compatible with launch.json for CodeLLDB)
* New contest will be named with letters from A to Z
* Command to copy code to clipboard (integration with caide)

## 0.2.5

* Build executable in windows properly.
* Warn user when there is no testcases available.

## 0.2.4

* Fix checker parameter order.

## 0.2.3

* Show compilation error and stderr on the terminal.

## 0.2.0

* Integration with Competitive-Companion. Parsing problems and contests is delegated to this tool.
* Generators are created automatically inspecting testcases. This is resolved with `tcgen`.

## 0.1.6

* Fix bug in windows detecting problem path
* Compile checker on user side to support multiple OS

## 0.1.5

* Users can create empty contest to be filled manually. Rename `personal` to `empty`.
* New configuration to set solutions folder. Important to set it before using the tool.
* Create contest with better names.
* Allow multiple languages. See [languages](doc/languages.md)
* Add two mini-tutorials and improve readme.
* Add key bindings for frequent commands.

## 0.1.4

* Fix problem in Codeforces parser

## 0.1.3

* Create settings that allow easy customization of template path, compilation line and max running time.
* How to use in README.md (enumerate all commands)

## 0.1.2

* Codeforces: Contest and Problem parsing.
* Command to compile code.
* Better placeholder text to provide contest-id problem-id.

## 0.1.1

* Running solution against testcases automatically.
* Stress solution using brute solution and generator.
* Measure program time.
* Add manual testcases.
* Process test cases in sorted order (specially starting from open testcase).
