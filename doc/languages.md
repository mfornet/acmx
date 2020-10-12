# Languages

You can use whatever language you want. To do that change settings properly:

-   Open settings (from command palette) or `Ctrl+,`
-   Go to `acmx.execution.compile`
-   Change this value to run your compilation line.

You have access to two variable in this line:

-   `$PROGRAM` the path to your solution. (in the case of C++ `/path/to/sol.cpp`)
-   `$OUTPUT` the path to an executable that run your program.

By default it is: `g++ -std=c++11 $PROGRAM -o $OUTPUT` which compile c++11 code using g++.
You can use other compilers, or even better, awesome scripts that solve your particular problem.
