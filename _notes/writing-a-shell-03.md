---
layout: page
title: "Writing a Shell: 03 Executing Commands"
---

This chapter is where we finally get to the interesting part of the shell -- executing commands.

# Fork and Exec

For smash to run commands, it needs the ability to create new processes. In Unix, this is accomplished with `fork()`, which creates a duplicate of the current process, and the `exec` family of functions, which overwrite the process that invokes it with a new one.

We'll start by just executing a single directive (i.e., no pipelines). To do this, we'll call fork and then `execvp`. Each function in the  `exec` family of functions has attributes. The 'v' in `execvp` denotes that the function takes a null terminated array of `char *` for its second argument, and the 'p' signifies that the path will be searched for the command provided as the first argument.

Since we need a null terminated array of `char *`, and the `args` field of a `Directive` is of type `vector<string>`, we need a way to convert the two. Each c++ `string` contains a pointer to the underlying `char *` array, so copying each of these pointers to a new array should do the trick. What's more, the `exec` functions clean up any memory used in their invocation, so we needn't worry about leaks.

Let's add a function to do just that, first in the header...

```c++
struct Directive {
    bool background;
    pid_t pid;
    std::string name, infile, outfile;
    std::vector<std::string> args;
    Directive *next;

    char **argv();
};
```

...and then the implementation file.

```c++
// parse.cpp
char **Directive::argv() {
    int argc = args.size() + 2;
    char **argv = new char *[argc];

    argv[0] = (char *)name.c_str();
    for (int i = 0; i < argc - 2; ++i) {
        argv[i + 1] = (char *)args[i].c_str();
    }
    argv[argc - 1] = nullptr;

    return argv;
}
```

Now let's invoke `fork()` and `execvp()`. The `fork()` function returns the pid of the child process in the parent, 0 in the child, and -1 if an error has occurred. The `execvp()` function should not return anything (it's overwriting the current process, aftera all), and if it does we know there's been an error. Finally, as the parent process, we need to `wait()` on the child process, telling the operating system that the process can be safely removed from its list of running processes. We can also take this chance to free up the `Directive`'s memory.

```c++
// exec.cpp
void exec(Directive *directive) {
    if (!directive) {
        return;
    }

    if (directive->name == "cd") {
        exec_cd(directive);
    } else if (directive->name == "exit") {
        exec_exit(directive);
    } else {
        // Fork the current process.
        if ((directive->pid = fork()) == -1) {
            throw ShellError("fork: an unknown error has occurred (errno = " +
                             to_string(errno) + ")");
        }

        // If we're in the child process...
        if (directive->pid == 0) {
            char **argv = ptr->argv();

            // Pass the name of the command to exec, and the null terminated
            // argument array (including the name of the command) to the new process.
            if (execvp(argv[0], argv)) {
                switch (errno) {
                case EACCES:
                    throw ProcessError(ptr->name + ": permission denied");
                case ENOENT:
                    throw ProcessError(ptr->name +
                                       ": no such file or directory");
                case ENAMETOOLONG:
                    throw ProcessError(ptr->name + ": pathname is too long");
                default:
                    throw ProcessError(
                        "exec: an unknown error has occurred (errno = " +
                        to_string(errno) + ")");
                }
            }
        }

        // Wait until the child process is finished and have the os reap it.
        if (waitpid(directive->pid, NULL, 0) == -1) {
            ShellError("waitpid: an unknown error has occurred (errno = " +
                        to_string(errno) + ")");
        }
        delete directive;
    }
}
```

We can now exec our directives in in `repl()` and `readfile()` instead of just printing them.

```c++
void repl() {
    string input;
    Directive *directive;
    Lexer lexer(cin);

    while (!lexer.eof()) {
        try {
            cout << prompt();
            directive = Parser(lexer).parse();
            exec(directive);
        } catch (LexError &err) {
            cerr << "Lex error: " << err.what() << endl;
        } catch (ParseError &err) {
            cerr << "Parse error: " << err.what() << endl;
        } catch (ShellError &err) {
            cerr << "Shell error: " << err.what() << endl;
        }
    }
}

void readfile(string filename) {
    ifstream infile(filename);
    if (!infile.is_open()) {
        throw ShellError("unable to open file " + filename);
    }

    Directive *directive;
    Lexer lexer(infile, false);
    Parser parser(lexer);

    try {
        while (!parser.eof()) {
            directive = parser.parse();
            exec(directive);
        }
    } catch (LexError &err) {
        cerr << "Lex error: " << err.what() << endl;
    } catch (ParseError &err) {
        cerr << "Parse error: " << err.what() << endl;
    } catch (ShellError &err) {
        cerr << "Shell error: " << err.what() << endl;
    }
}
```

# Background Processes

Now that we have the basics set up, supporting background processes is as easy as not waiting on the child process to finish. Instead, we'll add it to a global jobs vector that we'll periodically check for finished processes. Let's declare the vector first.

```c++
// exec.hpp
extern std::vector<Directive *> jobs;
```

If the process is a background process, we'll add it to the vector instead of waiting on it and notify the user by printing its pid to stdout.

```c++
// exec.cpp
    if (directive->background) {
        jobs.push_back(directive);
        cout << "[" << jobs.size() << "]"
             << " " << directive->pid << endl;
    } else {
        if (waitpid(directive->pid, NULL, 0) == -1) {
            ShellError("waitpid: an unknown error has occurred (errno = " +
                        to_string(errno) + ")");
        }
        delete directive;
    }
```

Finally, we need to periodically check this vector for finished processes. For now, we'll do this in every loop in the case of repl and once after interpreting a file.

```c++
// smash.cpp
vector<Directive *> jobs;

void repl() {
    string input;
    Directive *directive;
    Lexer lexer(cin);

    while (!lexer.eof()) {
        try {
            cout << prompt();
            directive = Parser(lexer).parse();
            exec(directive);
            reap_jobs();
        } catch (LexError &err) {
            cerr << "Lex error: " << err.what() << endl;
        } catch (ParseError &err) {
            cerr << "Parse error: " << err.what() << endl;
        } catch (ShellError &err) {
            cerr << "Shell error: " << err.what() << endl;
        }
    }
}

void readfile(string filename) {
    ifstream infile(filename);
    if (!infile.is_open()) {
        throw ShellError("unable to open file " + filename);
    }

    Directive *directive;
    Lexer lexer(infile, false);
    Parser parser(lexer);

    try {
        while (!parser.eof()) {
            directive = parser.parse();
            exec(directive);
            reap_jobs();
        }
    } catch (LexError &err) {
        cerr << "Lex error: " << err.what() << endl;
    } catch (ParseError &err) {
        cerr << "Parse error: " << err.what() << endl;
    } catch (ShellError &err) {
        cerr << "Shell error: " << err.what() << endl;
    }
}
```

As seen already, `waitpid()` blocks while waiting on a process. To avoid this behavior, we can pass it the `WNOHANG` option. This way, `waitpid()` returns 0 immediately if the processes isn't finished, leaving our background processes free to finish in their own time and a user to continue executing commands.

```c++
// smash.cpp
void reap_jobs() {
    int status;
    Directive *directive;

    for (unsigned int i = 0; i < jobs.size(); ++i) {
        directive = jobs[i];

        if ((status = waitpid(directive->pid, nullptr, WNOHANG))) {
            if (status == -1) {
                throw ShellError(
                    "waitpid: an unknown error has occurred (errno = " +
                    to_string(errno) + ")");
            }

            cout << "[" << i + 1 << "] " << directive->pid << " done\t"
                  << directive->full_name() << endl;
            delete directive;
            jobs.erase(jobs.begin() + i);
        }
    }
}
```

Now we really do have a basic shell on our hands.

```
❯ ./smash
ajbond /Users/ajbond/Documents/smash> echo hello
hello
ajbond /Users/ajbond/Documents/smash> ls
Makefile        exec.hpp        hello           lex.hpp         parse.cpp       parse.o         smash.cpp       test.sh
exec.cpp        exec.o          lex.cpp         lex.o           parse.hpp       smash           smash.dSYM
ajbond /Users/ajbond/Documents/smash> rm test.sh
ajbond /Users/ajbond/Documents/smash> sleep 5 &
[1] 12103
ajbond /Users/ajbond/Documents/❯ ./smash
ajbond /Users/ajbond/Documents/smash> echo hello
hello
ajbond /Users/ajbond/Documents/smash> ls
Makefile        exec.hpp        hello           lex.hpp         parse.cpp       parse.o         smash.cpp       test.sh
exec.cpp        exec.o          lex.cpp         lex.o           parse.hpp       smash           smash.dSYM
ajbond /Users/ajbond/Documents/smash> rm test.sh
ajbond /Users/ajbond/Documents/smash> sleep 5 &
[1] 12103
ajbond /Users/ajbond/Documents/smash>
[1] 12103 done  sleep 5
ajbond /Users/ajbond/Documents/smash>
```