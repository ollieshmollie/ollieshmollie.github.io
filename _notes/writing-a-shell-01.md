---
layout: page
title: "Writing a Shell: 01 Lexing and Parsing"
---

Let's write a shell in C++. This shell will support pipelines, file system navigation, input and output redirection, and background processes. Let's call it smash, for Student MAde SHell.

We'll start by creating a main function that does the following in a loop:
1. Prints a prompt.
2. Reads user input.
3. Prints that input.

```c++
// smash.cpp
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

> NOTE: For brevity, many of the code examples presented are missing the `using` and `#include` statements necessary to make the code compile.

Now we're ready to parse the input into structured data.

# The Grammar

In order to make input processing as painless as possible, we should define a grammar for valid input to smash.

```
statement ::= pipeline '&'
pipeline ::= redirection | redirection '|' pipe
redirection ::= command ('<' word) ('>' word)
command ::= word | word command
word ::= character | word character | '\'' word* '\'' word | '"' word '"' word*
character ::= (a-z | A-Z | 0-9 | [:punct:])*
```

Everything we do is based on this grammar. Anytime we need to add or change a feature, chances are the first step will be to modify the grammar.

# Lexing

Now for the lexing stage. The idea is to take an input string and divide it into tokens of different types. The parser will accept a stream of these tokens and make decisions about how to structure them based on the grammar. Let's start by defining a `Token` class.

```c++
// lex.hpp
struct Token {
    enum Type {
        eof = -1,
        amp = '&',
        bar = '|',
        gt = '>',
        lt = '<',
        newline = '\n',
        word
    };

    int type;
    std::string lexeme;
    Token(int type = word, std::string lexeme = "")
        : type(type), lexeme(lexeme) {}
    std::string to_string();
};
```

Each `Token::Type` represents a symbol in the grammar, and we've defined a method `to_string()` that can help with debugging.

For the lexing process we'll encode a [Finite State Machine](https://en.wikipedia.org/wiki/Finite-state_machine) with a `Lexer` class. Here's the definition.

```c++
class Lexer {
    std::istream &in;
    bool in_repl;

    Token to_start(char);
    Token to_comment(char);
    Token to_word(char, std::stringstream &);
    Token to_quote(char, std::stringstream &);
    Token to_eof();

  public:
    Lexer(std::istream &in, bool in_repl = true) : in(in), in_repl(in_repl) {}
    Token next_token();
    bool eof();
};
```

Each state reacts differently to different characters, and each state transition is associated with an action. In this representation, each private method represents both the transition and the response to different inputs.

>NOTE: We pass in `bool is_repl` to `Lexer`'s constructor because later on we'll be reading files and some aspects of the lexer will work slightly differently.

The main method used by the parser will be `next_token()`. Each successive call to this method will return the next token in the stream, until it reaches EOF. The definition of `next_token()`, `eof()`, and each state method is shown below.

```c++
#include "lex.hpp"

bool isop(char c) { return c == '&' || c == '|' || c == '>' || c == '<'; }
bool isspace(char c) { return c == ' ' || c == '\t' || c == '\v'; }

Token Lexer::to_start(char c) {
    stringstream out;

    while (isspace(c)) {
        in.get();
        c = in.peek();
    }

    if (c == '#') {
        return to_comment(c);
    } else if (c == '\n' || isop(c)) {
        return Token(in.get());
    } else if (c == EOF) {
        return to_eof();
    } else {
        return to_word(c, out);
    }
}

Token Lexer::to_comment(char c) {
    while ((c = in.get()) != '\n') {
    }
    return Token(c);
}

Token Lexer::to_word(char c, stringstream &out) {
    while (c != '\n' && !isspace(c) && !isop(c)) {
        if (c == EOF) {
            break;
        } else if (c == '\'' || c == '"') {
            return to_quote(in.get(), out);
        } else {
            out << (char)in.get();
        }
        c = in.peek();
    }

    return Token(Token::word, out.str());
}

Token Lexer::to_quote(char c, stringstream &out) {
    char delim = c;

    while ((c = in.get()) != delim) {
        if (c == EOF) {
            throw LexError("unexpected EOF, expected closing " +
                           string(1, delim));
        } else {
            out << c;
            if (c == '\n' && in_repl) {
                cout << "quote> ";
            }
        }
    }

    c = in.peek();
    return to_word(c, out);
}

Token Lexer::to_eof() { return Token(Token::eof); }

Token Lexer::next_token() {
    char c = in.peek();
    return to_start(c);
}

bool Lexer::eof() { return in.eof(); }
```

Note that `LexError` is just a wrapper around `std::runtime_error` is is defined thusly.

```c++
// lex.hpp
struct LexError : public std::runtime_error {
    LexError(const std::string &what) : runtime_error(what) {}
};
```

Before we get much further, it'd be nice if we had an easy way to build our project without having to type in the compiler directives every time. Let's do ourselves a favor and write a Makefile.

```make
# Makefile
CCFLAGS := -std=c++17
EXE := smash

$(EXE): smash.cpp lex.o
	$(CXX) $(CCFLAGS) $^ -o $@

lex.o: lex.cpp lex.hpp
	$(CXX) $(CCFLAGS) -c $< -o $@

.PHONY:
clean:
	rm *.o $(EXE)
```

Okay, looks good. Time for parsing.

# Parsing

Before we start structuring the tokens, we need to define such structures in code. One `Directive` class should hold all the data we need.

```c++
// parse.hpp
struct Directive {
    bool background;
    pid_t pid;
    std::string name, infile, outfile;
    std::vector<std::string> args;
    Directive *next;

    char **argv();
    std::string full_name();
};
```

The string `name` holds the actual command (e.g. 'echo' or 'ps'), and the `args` vector holds any arguments that follow. The strings `infile` and `outfile` are for redirection, and `next` points to the next command in the pipeline, if one exists. The `argv()` and `full_name()` functions will be used once we start executing the `Directives` in the terminal.

Similar to before, we want to overload `operator<<` to pretty-print the `Command` object. This time, though, we'll need a recursive helper function to facilitate printing the linked list.

```c++
// parse.cpp
void ostream_helper(std::ostream &os, const Directive *directive,
                    int num_spaces, int indent_width) {
    if (directive == nullptr) {
        return;
    }

    os << string(num_spaces, ' ');
    os << "Directive {" << endl;

    os << string(num_spaces + indent_width, ' ') << "pid: " << directive->pid
       << endl;
    os << string(num_spaces + indent_width, ' ') << "name: '" << directive->name
       << "'" << endl;

    if (directive->background) {
        os << string(num_spaces + indent_width, ' ') << "background: true"
           << endl;
    }

    if (!directive->infile.empty()) {
        os << string(num_spaces + indent_width, ' ') << "infile: '"
           << directive->infile << "'" << endl;
    }

    if (!directive->outfile.empty()) {
        os << string(num_spaces + indent_width, ' ') << "outfile: '"
           << directive->outfile << "'" << endl;
    }

    os << string(num_spaces + indent_width, ' ') << "args: [";
    for (unsigned int i = 0; i < directive->args.size(); ++i) {
        os << "'" << directive->args[i] << "'";
        if (i != directive->args.size() - 1) {
            os << ", ";
        }
    }
    os << "]" << endl;

    if (directive->next) {
        os << string(num_spaces + indent_width, ' ') << "next:" << endl;
        ostream_helper(os, directive->next, num_spaces + indent_width,
                       indent_width);
    }

    os << string(num_spaces, ' ') << "}";
    if (num_spaces) {
        os << endl;
    }
}

ostream &operator<<(ostream &os, const Directive *directive) {
    ostream_helper(os, directive, 0, 4);
    return os;
}
```

Now we need an object to store the state of the parsing process. `Parser` contains a `Lexer` and the current token in the token stream, and each private method corresponds to a grammar rule. The `eof()` method forwards the same method on `Lexer`.

```c++
// parse.hpp
class Parser {
    Lexer lexer;

    Token current_token;

    Directive *command(bool);
    Directive *redirection(bool);
    Directive *pipeline(bool);

  public:
    Parser(Lexer &lexer) : lexer(lexer) {}
    Directive *parse();
    bool eof();
};
```

Since the grammar is [context free](https://en.wikipedia.org/wiki/Context-free_grammar), we can pretty much directly translate it into a recursive descent parser. Let's start with `parse()`, which will get the ball rolling.

```c++
// parse.cpp
Directive *Parser::parse() {
    current_token = lexer.next_token();

    Directive *directive = pipeline(false);

    if (current_token.type == Token::amp) {
        directive->background = true;
        current_token = lexer.next_token();
    }

    return directive;
}
```

This method starts by advancing the token stream, then invoking the next highest precedence of our grammar, which is the `pipeline`. After that, it checks if the statement ends in an ampersand. This is the only one of our methods that doesn't have the same name as the grammar rule (`statement`) it's derived from. Up next is the rule for `pipeline`.

```c++
// parse.cpp
Directive *Parser::pipeline(bool in_expression) {
    Directive *directive = redirection(in_expression);

    while (current_token.type == Token::bar) {
        current_token = lexer.next_token();
        directive->next = pipeline(true);
    }

    return directive;
}
```

This one is simple. First we let the `redirection` rule apply, then we loop through the pipeline as long as there are '\|' tokens to consume, recursively parsing them as new pipelines. Now for redirection.

```c++
// parse.cpp
Directive *Parser::redirection(bool in_expression) {
    Directive *directive = command(in_expression);

    if (current_token.type == Token::lt) {
        current_token = lexer.next_token();

        if (current_token.type != Token::word) {
            throw ParseError("unexpected token " + current_token.to_string());
        }

        directive->infile = current_token.lexeme;

        current_token = lexer.next_token();
    }

    if (current_token.type == Token::gt) {
        current_token = lexer.next_token();

        if (current_token.type != Token::word) {
            throw ParseError("unexpected token " + current_token.to_string());
        }

        directive->outfile = current_token.lexeme;

        current_token = lexer.next_token();
    }

    return directive;
}
```

> NOTE: `ParseError` is almost exactly the same as `LexError`.

Like before, it's pretty much a direct translation from the grammar. We first check if there is a '<' to consume, then do the same for the '>' token. Finally, here's the method that corresponds to `command`.

```c++
// parse.cpp
Directive *Parser::command() {
    if ((current_token.type == Token::newline && !in_pipeline) ||
        current_token.type == Token::eof) {
        return nullptr;
    } else if (current_token.type == Token::newline && in_pipeline) {
        if (lexer.in_repl()) {
            cout << "pipe> ";
        }
        current_token = lexer.next_token();
    }

    if (current_token.type != Token::word) {
        throw ParseError("unexpected token " + current_token.to_string());
    }

    Directive *directive = new Directive();
    directive->name = current_token.lexeme;

    current_token = lexer.next_token();
    while (current_token.type == Token::word) {
        directive->args.push_back(current_token.lexeme);
        current_token = lexer.next_token();
    }

    return directive;
}
```

> NOTE: We ignore any newline or eof token detected if the user is not in the middle of writing an expression (or EOF has been reached). Also, similar to the Lexer, if we're in a repl we print a special prompt if the user keys in a newline in the middle of a pipeline.

We also forward the `Lexer::eof()` method to the parser so that it knows when it's not possible to keep going.

```c++
// parser.cpp
bool Parser::eof() { return lexer.eof(); }
```

Now let's instantiate a `Lexer` and a `Parser` in the main program...

```c++
// smash.cpp
int main() {
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
        }
    }

    return 0;
}
```

...modify our makefile to include the new parsing module...

```make
# Makefile
$(EXE): smash.cpp lex.o parse.o shell.o
	$(CXX) $(CCFLAGS) $^ -o $@

parse.o: parse.cpp parse.hpp
	$(CXX) $(CCFLAGS) -c $< -o $@
```

...and try it out!

```
❯ ./smash
smash> echo hello &
Directive {
    pid: 0
    name: 'echo'
    background: true
    args: ['hello']
}
smash> cat < in > out
Directive {
    pid: 0
    name: 'cat'
    infile: 'in'
    outfile: 'out'
    args: []
}
smash> echo 'hello
quote> world' |
pipe> grep 'hello' |
pipe> grep 'lo'
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
ajbond /home/ajbond/Documents/smash>
```
