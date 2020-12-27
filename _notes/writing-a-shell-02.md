---
layout: page
title: "Writing a Shell: 02 Built In Commands and Input Files"
---

# Changing Directories

Let's start the execution phase by implementing changing directories. Shells usually execute commands by spawning a child process, executing the command, then returning to the shell process. Commands `cd` can't work like that because if it executed a change of directory in the child process, the parent process wouldn't see it and you'd still be in the same directory. Luckily there's `chdir()`, which will do nicely.

First, we need to identify whether a command is a directive like `cd`. Then, we can write a function to execute those functions specially.

```c++
// exec.cpp
void exec(Directive *directive) {
    if (directive->name == "cd") {
        exec_cd(directive);
    }
}
```

Before we implement `cd`, let's create a global struct that'll hold some shell environment variables.

```c++
// exec.hpp
extern struct shell {
    std::string USER;
    std::string HOME;
    std::string OLDPWD;
} shell;
```

We've declared the struct, but we still need to initialize it. Let's do that near our main function, using `getpwuid()` to get the user's name and home directory. Let's also display the user name and current directory in the prompt.

```c++
// smash.cpp
struct shell shell;

void init() {
    struct passwd *pw;
    pw = getpwuid(getuid());
    shell.USER = string(pw->pw_name);
    shell.HOME = string(pw->pw_dir);
}

std::string prompt() {
    stringstream ss;
    ss << shell.USER << " " << filesystem::current_path().string() << "> ";
    return ss.str();
}
```

Okay, back to `cd`. If there are no arguments, we should change to the user's home directory. If the argument is "-" we should change to the previous directory (if there is one). Otherwise, we should try to change to the path supplied by the user. System calls like `chdir` use a global number `errno` to report any errors; we'll handle some of the more common ones.

```c++
// exec.cpp
void exec_cd(Directive *directive) {
    string arg, oldpwd = string(std::filesystem::current_path());

    if (directive->args.empty()) {
        arg = shell.HOME;
    } else if (directive->args[0] == "-") {
        if (!shell.OLDPWD.empty()) {
            arg = shell.OLDPWD;
        }
    } else {
        arg = directive->args[0];
    }

    if (chdir(arg.c_str()) == -1) {
        switch (errno) {
        case EACCES:
            throw ShellError("cd: permission denied");
        case EFAULT:
        case ENAMETOOLONG:
            throw ShellError("cd: name too long");
        case ENOENT:
            throw ShellError("cd: " + arg + " does not exist");
        default:
            throw ShellError("cd: an unknown error has occurred (errno = " +
                             to_string(errno) + ")");
        }
    }

    shell.OLDPWD = oldpwd;
}
```

# A Smooth Exit

Up until now we've had to hit 'Ctrl C' to exit smash. Let's fix that. The `exit` directive is also built in, so we can chck for it in `exec()`.

```c++
// exec.cpp
void exec(Directive *directive) {
    if (directive->name == "cd") {
        exec_cd(directive);
    } else if (directive->name == "exit") {
        exec_exit(directive);
    }
}
```

The implementation of `exit` is a lot simpler than `cd`. It can optionally take an exit code as an argument, so we'll check for that first. Then, we'll throw an exception to get back to the main program.

```c++
// exec.cpp
void exec_exit(Directive *directive) {
    int status = 0;

    if (!directive->args.empty()) {
        try {
            status = stoi(directive->args[0]);
        } catch (std::invalid_argument &err) {
        }
    }

    delete directive;

    throw Exit(status);
}
```

> NOTE: I think some might frown at using an exception for control flow here. But I think it's a clean, easily understandable way to do it.

The `Exit` struct is, as you'd imagine, a struct wrapping an integer.

```c++
// exec.hpp
struct Exit {
    int status;
    Exit(int status) : status(status) {}
};
```

And in our main program, we'll track a status integer and catch `Exit` when it's thrown.

```
// smash.cpp
int main() {
    int status = 0;
    string input;
    Directive *directive;
    Lexer lexer(cin, true);

    while (true) {
        cout << "smash> ";

        try {
            cout << "smash> ";

            directive = Parser(lexer).parse();

            if (directive) {
                cout << directive << endl;
            }

        } catch (LexError &err) {
            cerr << "Lex error: " << err.what() << endl;
        } catch (ParseError &err) {
            cerr << "Parse error: " << err.what() << endl;
        } catch (Exit &err) {
            status = err.status;
            break;
        }
    }

    return status;
}
```

As usual, now that we've coded it up, let's try it out!

```
❯ ./smash
ajbond /home/ajbond/Documents/smash> cd
ajbond /home/ajbond> cd -
ajbond /home/ajbond/Documents/smash> cd ..
ajbond /home/ajbond/Documents> cd smash
ajbond /home/ajbond/Documents/smash> exit
❯
```

# Reading an Input File

By choosing to pass a generic `istream` object to the lexer and parser, we should be able to read a file in the same way we do text from the terminal. First, let's rework our main function to handle files.

```c++
// smash.cpp
int main(int argc, char **argv) {
    init();

    try {
        if (argc == 1) {
            repl();
        } else {
            readfile(argv[1]);
        }
    } catch (ShellError &err) {
        cerr << "Shell error: " << err.what() << endl;
    } catch (Exit &err) {
        return err.status;
    }

    return 0;
}
```

Now we need to implement `repl()` and `readfile()`. The former is just moving what we had before into its own function.

```c++
// smash.cpp
void repl() {
    string input;
    Directive *directive;
    Lexer lexer(cin, true);

    while (true) {
        try {
            cout << prompt();
            directive = Parser(lexer).parse();
            if (directive) {
                cout << directive << endl;
            }
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
```

The `readfile()` function is similar, but it consumes tokens from the file until EOF is reached.

```c++
// smash.cpp
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
            if (directive) {
                cout << directive << endl;
            }
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

Let's craft a test file and make sure things are working as they should.

```
# test.smash
echo hello &
cat < in > out
echo 'hello
world' |
grep 'hello' |
grep 'lo'
```

```
❯ ./smash test.smash
Directive {
    pid: 0
    name: 'echo'
    background: true
    args: ['hello']
}
Directive {
    pid: 0
    name: 'cat'
    infile: 'in'
    outfile: 'out'
    args: []
}
Directive {
    pid: 0
    name: 'echo'
    args: ['hello
world']
    next:
    Directive {
        pid: 0
        name: 'grep'
        args: ['hello']
        next:
        Directive {
            pid: 0
            name: 'grep'
            args: ['lo']
        }
    }
}
❯
```