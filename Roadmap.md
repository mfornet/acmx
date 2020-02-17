# AcmX

## Wiki

Hacer wiki de acmx.
Debe contener intro. (Tutorial con lo mínimo indispensable para echarlo a andar con poco esfuerzo).
Idealmente links a algunos videos mostrando como usar la herramienta.
Wiki explicando los features de esta herramienta y como configurarlos.

## UX

No configuration should be needed by default and it should work out of the box.

## Support for multiple languages

Diferentes configuraciones (con el ejemplo completo del workspace) donde se resuelva un problema en diferentes lenguajes (priorizar los mas importantes en acm).

Incluir por defecto soporte para multiples lenguajes.

Diferentes lenguajes, tanto para la solución, como para la solución bruta, generador, checker.
Quizas hacer una wiki al respecto, como hacer configuraciones especiales.

+ C++
+ JavaP
+ Python
+ Rust / D / Kotlin (intentar construir ejemplos en estos lenguajes).

Se puede hacer un proyecto, acmx-examples que contenga los diferentes ejemplos, y de donde se puedan copiar las diferentes configuraciones por lenguaje. Como parte de los integrations tests correr varios tests sobre los examples, seria bastante interesante.

### Support for extra tools

Estoy pensando que yo quiero tener acceso a testlib con auto-completamiento y potencialmente a la libreria de algoritmos, quizas a jngen tambien. pero por supuesto no se puede estar copiando todo el tiempo. Entonces seria bueno ver si se puede incluir como un environment y pasar los argumentos correspondientes.

## Commands

    Crear un problema nuevo.
        Se debe crear dentro de:
            solutions/orphans/problem/$name

    Crear un concurso nuevo.
        El nombre de los problemas deberia ser con letras en lugar de con numeros.
        Intentar implementar un parser para pdf / sacar cantidad de problemas / nombres.
            solutions/orphans/contest/$name

    Fix testcase (este es un comando que se ejecuta con click derecho sobre los ficheros gen.in)

    View code:
        Cambiar la vista a ver el código.

    Compile:
        Compile only. Si hay error de compilación (o warning) debería mostrarlos.
        Esto es la salida de error. Mostrar en el status bar: compilation failed (exit code) / compilation succeeded.

    Open testcase:
        Lista todos los testcases y abre uno en particular.

    Run:

    Stress:
        Corre generador (si hay fuerza bruta correrlo también).
        Para el stres testing se puede definir máximo tiempo corriendo o maximo numero de iteraciones.

    Add brute solution:
        Cuando hay brute solution, y esta enabled para los ficheros que no tengan salida usarlo como comparador. Idealmente solo compilar si es necesario.

    Disable brute solution:
        Aunque haya un brute solution en el environment, no usarlo.
        Cuando le das click a una solucion que pueda hacer la funcion de bruto permitir la opcion, anhadir como brute force.
        Cuando le das click al actual fuerza bruta permitir 

    Upgrade:
        Crea todos los ficheros necesarios para

    Set checker:
        Por defecto se usa token comparator

    Submit:
        Hacer un feature en el competitive companion que permita hacer submit automaticamente.
        

    Update contest:
        Quizas sea util para reformatear mas cosas.

## Tool structure

Estructura de la carpeta donde se archivan todas las soluciones.

    solutions/
        orphan/
            problems/
                problem-name...
            contest-name...
        contest-name...

Estructura de un problema

    problem/
        .attic/
            config.json
            ejecutables y demas ficheros que se generan.
        testcases/
            test$id.in
            test$id.out
            test$id.hand.in
            test$id.hand.out
            test$seed.gen.in
            test$seed.gen.out
            test$id.hand.brute.out
            test$id.hand.sol.out
        solution.cpp
        gen.py
        brute.cpp
        checker.cpp

### Problem config

Habilitar un config para un problema en particular (`config.json`)
    - time to time limit
    - max memory (this will be enforced per p)
    - si es interactivo o no.
    - numero de casos de pruebas a generar en el stress.
    - short circuit (correr hasta el primero que falle, o correr todos y luego hacer reporte).
    - si esta habilitado o no el checker.
    - hashsum de los ficheros compilados para no tener que volverlos a compilar.
    - datos del problema (url probablemente) para hacerle queries al competitive companion
        - metadatos descargados del problema / concurspo
    - version del acmx donde se ejecuto

Potencialmente crear un config para el concurso, tambien.
Permitir editar estos json config en una interfaz comoda del vscode (como la de los settings).

### Parsing information

Cuando se parsea la informacion del competitive companion usar los limites de tiempo limite y memoria limite para la ejecucion del programa. Entonces hay varias opciones disponibles:

+ Usar tiempo limite global para el problema
+ Usar tiempo limite particular para el problema.
+ Usar tiempo limite descargado para el problema.
+ Usar tiempo limite descargado multiplicado por un factor. Quizas se puede incluso hacer que el factor sea dependiente de la plataforma.

### Test case handling

Manejar los testcases de una forma similar al chelper / jhelper, que permita manejar que testcases debe ser ejecutados y cuales no. Buttons: [All/None] Checkmark para marcar no marcar, permitir ver los testcases.

Probablemente esto requiera de un boton para abrir la interfaz que permita manejar los testcases.

### Run summary

Se genera un resumen de los errores. El tiempo / memoria tamanho de entrada y de salida por cada caso de prueba, y si tuvieron algo por la salida de error. Imprimir la salida para todos los problemas (preferiblemente la salida resumida en caso de que sea muy grande).

Permitir casos de pruebas que no tengan output, deben correr y no ser reportados como WA.

### Smart copy

Esto deberia ser una herramienta a parte de acmx, y basicamente lo que debe permitir es crear un fichero con todo el contenido de los includes en el caso de c++. Debe ser una herramienta con una extension en el vscode.

### Generator

Si hay un fichero que tenga prefijo gen, se usa para generar casos de pruebas. Se espera que ese fichero reciba una semilla (un entero de 32 bits) y genere de forma determinista un caso de prueba, esto es para lograr reproducibilidad.

Tener ejemplos de generadores en diferentes lenguajes.
Permitir cambiar la plantilla de los ejemplos.
Se tiene un formato para poder compilar / ejecutar codigos en diferentes lenguajes.

Se generan x casos de pruebas aleatorios y se ejecutan las soluciones en los mismos.
Se corre el codigo en cada caso de prueba de forma independiente.

Los casos de pruebas que se generan se quedan en el directorio sin ser borrados (el nombre es test$seed.gen.in). Crear un comando que con click derecho, si el fichero se llama test$seed.gen.in, poder convertirlo en hand$id.hand.in (donde id sea el maximo + 1)

### Brute force

Si hay fuerzas brutas disponibles, crear el ejecutable de la forma que exista disponible para ese lenguaje, generar preferiblemente los ejecutables en la carpeta `.attic`
Cuando se ejecute

### Interactive

## Integration tests

+ Hacer test de cada funcionalidad.
+ Intentar hacer test en la nube usando todas las plataformas.
+ Probablemente necesite hacerme un mock-online judge, util para prober muchas funcionalidades, incluyendo integration tests con el competitive companion. Quizas en lugar de usar un mock online judge pueda usar una instancia del mog, esto suena como una buena idea.

https://code.visualstudio.com/api/working-with-extensions/continuous-integration

## Nightly

Seria bueno tener features nightly que pueden no funcionar por plataforma.

### Memory

Tratar de medir la memoria probablemente esto se tenga que manejar de forma independiente por plataforma.
En linux se puede usar runlim, o quizas algunos programas de rust que pueden conocer la memoria por subproceso.

### Automatic submit

Hacer submit desde esta aplicacion usando el competitive companion.
Quizas sea necesario hacer una herramienta nueva, para no ser tan intrusivos en el competitive companion.

https://developer.chrome.com/apps/sockets_tcpServer

### Detect status

Detectar el status del problema desde el competitive companion: Aceptado / Intentado / No intentado.
Si es un live contest, intentar descargar mas datos. Como por ejemplo cuantos integrantes han resuelto cada problema. Si es un live contest, intentar hacer descargas mas frecuentes al comienzo de la competencia, y luego mas despacio. (Detectar contest virtuales en el codeforces).

Mostrar algunos datos del problema quizas en un README.md o algo asi, que se cargue de forma bonita!
Si es una competencia en vivo del codeforces se puede intentar hacer fetch al RatingChangeTool e intentar poner esos datos en el status bar. El predicted delta.

## Others

Hacer una herramienta en typescript que wrapee efectivamente la interaccion con los codigos, que permita, compilarlos, ejecutarlos con diferentes opciones y que se puede extraer informacion del mismo al final. Salida, salida de error, tiempo de ejecucion, errores, etc... Esta interfaz sera la empleada finalemente para ejecutar las soluciones en diversos lenguajes, fuerzas brutas, generadores, checkers.

## Machine Learning features

### TCGen

Traer para aca los comentarios del tcgen.

### Find complexity

Detectar la complejidad de los problemas por el texto. 
Fundamentalmente ordenar los problemas por dificultad, o sea, incluso aunque la complejidad no sea clara, el orden entre los problemas deberia ser util.

### Classify per subject

Intentar hacer un clasificador que prediga los temas y features de cada problema.

+ Temas generales (DP, Greedy, Geometria, String, Hashing, Graph, etc...)
+ Features particulares:
        small to min
        Accumulative array
        suffix array
        suffix automata
        bipartite graph
        maximum flow

### Automatic error finder

Tool to find most frequent errors.

Idea: Download pair of solutions from codeforces of the form

FAIL -> OK 

and find diff between both codes. Try to learn which part of the codes changed.
Ideally try to also suggest valid code.

## Add nightly features to competitive companion extension

Consider creating a separate extension

## Competitive Companion features

+ Add MOG as valid online judge
+ Add Project Euler as valid online judge
    Basically create a new folder to run solution since no testcase can be parsed.

Competitive companion should send json files once it has all files ready to be sent.
On the vscode end we can wait a 100ms timeout for all json files in case more files are coming.

## Crawler de varios online judges

Descargar problemas nuevos. Sobre todo para hacerle testing a los algoritmos de machine learning.
Test cases / Statements / Metadata / Solution

## Issues

### First use not working

When used for the first time it can't create a new folder with global attic. In that case it should specify to set the path to store all problems. Use by default some standard location like ~/.acmx/solutions so it always work, even after the first use.

### Allow read / write to file

Some times it is required that you should read and write from file, in that case set infrastructure so it works in this way. Probably copy file to the attic with given name, and run binary (read output from expected output).

### Garbage files

Right now on the mac competitive companion extension is creating two new files in the current directory which is not what is expected.

### Real into expected

Change extension of testcases from .real to .expected

It can be:

4.hand.output.out
4.hand.expected.out

### Remove .exe

Remove .exe from the extension since I think it should work in all languages

## Tests are not passing right now
