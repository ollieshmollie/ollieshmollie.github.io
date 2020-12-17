---
layout: page
title: Writing a Shell
---

Let's write a shell in C++. This shell will support pipelines, file system navigation, input and output redirection, and background processes. Let's call it smash, for Student MAde SHell.

We'll start by creating a main function that does the following in a loop:
1. Prints a prompt.
2. Reads user input.
3. Prints that input.

```c++
//smash.cpp
using namespace std;

int main() {
    string input;

    while (true) {
        cout << "smash> ";
        getline(cin, input);
        cout << input << endl;
    }

    return 0;
}
```

Now we're ready to parse the input into structured data.

# The Grammar

In order to make input processing as painless as possible, we should define a grammar for valid input to smash.

```
statement ::= pipeline '&'
pipeline ::= redirection | redirection '|' pipe
redirection ::= command ('<' word) ('>' word)
command ::= word | word command
word ::= character | word character | '\'' word '\'' | '"' word '"'
character ::= (a-z | A-Z | 0-9 | [:punct:])*
```

Everything we do from here on in will be based on this grammar. Anytime we need to add or change a feature, chances are the first step will be to modify the grammar.

# Lexing

Now for the lexing stage. The idea is to take an input string and divide into tokens of different types. The parser can then read these tokens and make decisions about how to structure them based on the grammar. Let's start by defining a `Token` class.

```c++
// lex.hpp
enum TokenType {
    TOK_EOF,
    TOK_AMP, // '&'
    TOK_BAR, // '|'
    TOK_GT,  // '>'
    TOK_LT,  // '<'
    TOK_WORD
};

struct Token {
    TokenType type;
    std::string lexeme;
    Token(TokenType type, std::string lexeme = "")
        : type(type), lexeme(lexeme) {}
};
```

The C++ standard library has a handy `stringstream` class that can easily extract formatted data from strings. Let's use one to read a single `Token`.

```c++
// lex.cpp
#include "lex.hpp"

using std::string;
using std::stringstream;

Token next(stringstream &ss) {
    char c, delim;
    string lexeme;

    c = ss.peek();

    // Skip leading whitespace
    while (isspace(c)) {
        ss.get();
        c = ss.peek();
    }

    switch (c) {
    case EOF:
        ss.get();
        return Token(TOK_EOF, "EOF");
    case '&':
        ss.get();
        return Token(TOK_AMP, "&");
    case '|':
        ss.get();
        return Token(TOK_BAR, "|");
    case '>':
        ss.get();
        return Token(TOK_GT, ">");
    case '<':
        ss.get();
        return Token(TOK_LT, "<");
    case '\'':
    case '"':
        delim = ss.get();
        while ((c = ss.get()) != delim) {
            lexeme.push_back(c);
        }
        return Token(TOK_WORD, lexeme);
    default:
        ss >> lexeme;
        return Token(TOK_WORD, lexeme);
    };
}
```

Next, let's define a function that takes an input string, wraps it in a `stringstream`, and fills a `Token` array with calls to `next()`.

```c++
// lex.cpp
std::vector<Token> lex(string &input) {
    stringstream ss(input);
    std::vector<Token> tokens;

    while (!ss.fail()) {
        tokens.push_back(next(ss));
    }

    return tokens;
}
```

Finally, let's make sure we can print each token in a helpful way by overloading `operator<<`.

```c++
// lex.cpp
std::ostream &operator<<(std::ostream &os, const Token &token) {
    os << "Token{type: ";

    switch (token.type) {
    case TOK_EOF:
    case TOK_AMP:
    case TOK_BAR:
    case TOK_GT:
    case TOK_LT:
        os << token.lexeme;
        break;
    default:
        os << "WORD, lexeme: " << token.lexeme;
    }

    os << "}";

    return os;
}
```

The last two functions we defined are going to be called from our main program, so we should expose them in the header file.

```c++
// lex.hpp
std::vector<Token> lex(std::string &input);
std::ostream &operator<<(std::ostream &os, const Token &token);
```

Let's modify our main program to test the lexer.

```c++
int main() {
    string input;

    while (true) {
        cout << "smash> ";
        getline(cin, input);

        vector<Token> tokens = lex(input);

        for (const Token &t : tokens) {
            cout << t << endl;
        }
    }

    return 0;
}
```

Before we test it, it'd be nice if we had an easy way to build our project without having to type in the compiler directives every time. Let's do ourselves a favor and write a Makefile.

```make
# Makefile
CCFLAGS := -std=c++17
EXE := smash

$(EXE): smash.cpp lex.o parse.o
	$(CXX) $(CCFLAGS) $^ -o $@

lex.o: lex.cpp lex.hpp
	$(CXX) $(CCFLAGS) -c $< -o $@

.PHONY:
clean:
	rm *.o $(EXE)
```

Right, now we can compile, run, and test our lexer.

```
❯ ./smash
smash> echo hello
Token{type: WORD, lexeme: echo}
Token{type: WORD, lexeme: hello}
Token{type: EOF}
smash> cat < input > ouput &
Token{type: WORD, lexeme: cat}
Token{type: <}
Token{type: WORD, lexeme: input}
Token{type: >}
Token{type: WORD, lexeme: ouput}
Token{type: &}
Token{type: EOF}
smash> echo 'single token string' | grep token
Token{type: WORD, lexeme: echo}
Token{type: WORD, lexeme: single token string}
Token{type: |}
Token{type: WORD, lexeme: grep}
Token{type: WORD, lexeme: token}
Token{type: EOF}
smash>
```

Looks good. Time for parsing.

# Parsing

Before we start structuring the tokens, we need to define such structures in code. For simplicity, one `Command` class should hold all the data we need.

```c++
// parse.hpp
struct Command {
    bool background;
    std::string name, infile, outfile;
    std::vector<std::string> args;
    Command *next;
};
```

The string `name` holds the actual command (e.g. `echo` or `ps`), and the `args` vector holds any arguments that follow. The strings `infile` and `outfile` are for redirection, and `next` points to the next command in the pipeline, if one exists.

Since our grammar is [context free](https://en.wikipedia.org/wiki/Context-free_grammar), we can pretty much directly translate it into a recursive descent parser. We'll use an iterator (and a `typedef` for convenience) to iterate through the `Token` array and create the appropriate `Command` object.

```c++
// parse.cpp
#include "parse.hpp"

using std::string;
using std::vector;

Command *command(TokenIterator &token_iterator, bool parsing) {
    Command *commandp;
    commandp = new Command();

    Token token = *token_iterator++;

    if (token.type == TOK_EOF) {
        if (parsing) {
            throw ParseError("unexpected EOF");
        }
        return nullptr;
    }

    if (token.type != TOK_WORD) {
        throw ParseError("unexpected token '" + token.lexeme +
                         "', expected WORD");
    }

    commandp->name = token.lexeme;

    while (token_iterator->type == TOK_WORD) {
        commandp->args.push_back(token_iterator->lexeme);
        ++token_iterator;
    }

    return commandp;
}

Command *redirection(TokenIterator &token_iterator, bool parsing) {
    Command *commandp;

    commandp = command(token_iterator, parsing);

    if (token_iterator->type == TOK_LT) {
        Token redirect_op = *token_iterator++;

        if (token_iterator->type != TOK_WORD) {
            throw ParseError("unexpected token '" + token_iterator->lexeme +
                             "', expected outfile");
        }

        commandp->infile = token_iterator->lexeme;
        ++token_iterator;
    }

    if (token_iterator->type == TOK_GT) {
        Token redirect_op = *token_iterator++;

        if (token_iterator->type != TOK_WORD) {
            throw ParseError("unexpected token '" + token_iterator->lexeme +
                             "', expected infile");
        }

        commandp->outfile = token_iterator->lexeme;
        ++token_iterator;
    }

    return commandp;
}

Command *pipeline(TokenIterator &token_iterator, bool parsing) {
    Command *commandp, **next_command;

    commandp = redirection(token_iterator, parsing);
    next_command = &commandp->next;

    while (token_iterator->type == TOK_BAR) {
        *next_command = redirection(++token_iterator, true);
        next_command = &(*next_command)->next;
    }

    if (token_iterator->type == TOK_AMP) {
        commandp->background = true;
        ++token_iterator;
    }

    if (token_iterator->type != TOK_EOF) {
        throw ParseError("unexpected token '" + token_iterator->lexeme +
                         "', expected EOF");
    }

    return commandp;
}

Command *parse(vector<Token> &tokens) {
    TokenIterator it = tokens.begin();
    return pipeline(it, false);
}
```

Notice we track whether or not we're in the middle of parsing in order to know if it's an error to encounter EOF. If the user hits enter, we want to ignore it. But if we encounter EOF in the middle of a pipeline, we should say something.

Similar to before, we want to overload `operator<<` to pretty-print the `Command` object. This time, though, we'll need a recursive helper function to facilitate printing the linked list.

```c++
// parse.cpp
void ostream_helper(std::ostream &os, const Command *command, int num_spaces,
                    int indent_width) {
    if (command == nullptr) {
        return;
    }

    os << string(num_spaces, ' ');
    os << "Command {" << std::endl;

    os << string(num_spaces + indent_width, ' ') << "pid: " << command->pid
       << std::endl;
    os << string(num_spaces + indent_width, ' ') << "name: " << command->name
       << std::endl;

    if (command->background) {
        os << string(num_spaces + indent_width, ' ') << "background: true"
           << std::endl;
    }

    if (!command->infile.empty()) {
        os << string(num_spaces + indent_width, ' ')
           << "infile: " << command->infile << std::endl;
    }

    if (!command->outfile.empty()) {
        os << string(num_spaces + indent_width, ' ')
           << "outfile: " << command->outfile << std::endl;
    }

    os << string(num_spaces + indent_width, ' ') << "args: [";
    for (unsigned int i = 0; i < command->args.size(); ++i) {
        os << command->args[i];
        if (i != command->args.size() - 1) {
            os << ", ";
        }
    }
    os << "]" << std::endl;

    if (command->next) {
        os << string(num_spaces + indent_width, ' ') << "next:" << std::endl;
        ostream_helper(os, command->next, num_spaces + indent_width,
                       indent_width);
    }

    os << string(num_spaces, ' ') << "}";
    if (num_spaces) {
        os << std::endl;
    }
}

std::ostream &operator<<(std::ostream &os, const Command *command) {
    ostream_helper(os, command, 0, 4);
    return os;
}
```

Also as before, we need to expose the core parsing functions for the main function to use.

```c++
// parse.hpp
Command *parse(std::vector<Token> &tokens);
std::ostream &operator<<(std::ostream &os, const Command *command);
```

Now let's call `parse()` in the main program...

```c++
#include "parse.hpp"

using namespace std;

int main() {
    string input;

    while (true) {
        cout << "smash> ";
        getline(cin, input);

        try {
            vector<Token> tokens = lex(input);

            Command *command = parse(tokens);
            if (command) {
                cout << command << endl;
            }

        } catch (ParseError &err) {
            cerr << "Parse error: " << err.what() << endl;
        }
    }

    return 0;
}
```

...modify our makefile to include the new parsing module...

```make
# Makefile
parse.o: parse.cpp parse.hpp
	$(CXX) $(CCFLAGS) -c $< -o $@
```

...and test it!

```
❯ ./smash
smash> echo hello &
Command {
    pid: 0
    name: echo
    background: true
    args: [hello]
}
smash> cat text < in > out
Command {
    pid: 0
    name: cat
    infile: in
    outfile: out
    args: [text]
}
smash> echo 'single token string' | grep "single token" | grep token
Command {
    pid: 0
    name: echo
    args: [single token string]
    next:
    Command {
        pid: 0
        name: grep
        args: [single token]
        next:
        Command {
            pid: 0
            name: grep
            args: [token]
        }
    }
}
smash>
```

# Changing Directories

Let's start the execution phase by implementing changing directories. Shells usually execute commands by spawning a child process, executing the command, then returning to the shell process. The `cd` directive can't work like that because if it executed a change of directory in the child process, the parent process wouldn't see it and you'd still be in the same directory. Luckily there's `chdir()`, which will do nicely.

First, we need to identify whether a command is a directive like `cd`. Then, we can write a function to execute those functions specially.

```c++
// shell.cpp
bool is_builtin(Command *command) { return command->name == "cd"; }

void exec(Command *command) {
    if (is_builtin(command)) {
        exec_builtin(command);
        return;
    }
}
```

Before we implement `cd`, let's create a global struct that'll hold some shell environment variables.

```c++
// shell.hpp
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

Okay, back to `cd`. If there are no arguments, we should change to the user's home directory. If the argument is "-" we should change to the previous directory (if there is one). Otherwise, we should try to change to the path supplied by the user. We'll detect if any errors occured from the return value of `chdir()`.

```c++
// shell.cpp
void exec_builtin(Command *command) {
    if (command->name == "cd") {
        string oldpwd = string(std::filesystem::current_path());
        string arg;

        if (command->args.empty()) {
            arg = shell.HOME;
        } else if (command->args[0] == "-") {
            if (!shell.OLDPWD.empty()) {
                arg = shell.OLDPWD;
            }
        } else {
            arg = command->args[0];
        }

        if (chdir(arg.c_str()) == -1) {
            switch (errno) {
            case EACCES:
                throw ShellError("cd: permission denied");
            case EFAULT:
                throw ShellError("cd: " + arg +
                                 " is outside accessible address space");
            case EIO:
                throw ShellError("cd: an I/O error occurred");
            case ELOOP:
                throw ShellError(
                    "cd: too many symbolic links were encountered");
            case ENAMETOOLONG:
                throw ShellError("cd: name too long");
            case ENOENT:
                throw ShellError("cd: " + arg + " does not exist");
            case ENOMEM:
                throw ShellError("cd: insufficient kernel memory available");
            case ENOTDIR:
                throw ShellError("cd: a component of " + arg +
                                 " is not a directory");
            default:
                throw ShellError("cd: an unknown error has occurred");
            }
        }

        shell.OLDPWD = oldpwd;
    }
}
```

Let's also add the current directory to the prompt so we can see if `cd` is working properly.

```c++
// smash.cpp
std::string prompt() {
    stringstream ss;
    ss << "smash " << filesystem::current_path() << " $ ";
    return ss.str();
}
```

Lastly, we need to define `ShellError` (it's just like `ParseError`), expose `exec()`, and call it from our main function. For brevity, I'll only include the last bit.

```c++
// smash.cpp
int main() {
    string input;

    init();

    while (true) {
        cout << prompt();
        getline(cin, input);

        try {
            vector<Token> tokens = lex(input);

            Command *command = parse(tokens);

            if (command) {
                exec(command);
            }

        } catch (ParseError &err) {
            cerr << "Parse error: " << err.what() << endl;
        } catch (ShellError &err) {
            cerr << "Shell error: " << err.what() << endl;
        }
    }

    return 0;
}
```

Let's try it out!

```
❯ ./smash
ajbond /Users/ajbond/Dev/smash> cd
ajbond /Users/ajbond> cd -
ajbond /Users/ajbond/Dev/smash> cd ..
ajbond /Users/ajbond/Dev> cd smash
ajbond /Users/ajbond/Dev/smash> cd lskdfj
Shell error: cd: lskdfj does not exist
ajbond /Users/ajbond/Dev/smash>
```

# Fork and Exec
