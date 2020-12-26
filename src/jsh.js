var jshContainer = document.querySelector("#jshContainer");
var jshTextArea = document.querySelector("#jshTextArea");
var snakeCanvas = document.querySelector("#snakeCanvas");
var pwd = "~";
var inputBuffer = "";
var cursorPos = beginningOfLine();

// Disable focusing away from textarea
document.addEventListener("click", function(e) {
    jshTextArea.focus();
});

// Always restore cursor position even if you click
jshTextArea.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.selectionStart = this.selectionEnd = cursorPos;
});

// Insert text into buffer
jshTextArea.addEventListener("input", function(e) {
    inputBuffer = this.value.substr(beginningOfLine());
});

function handleKeydown(e) {
    // Handle newline 
    if (e.keyCode === 13) {
        e.preventDefault();
        cursorPos = beginningOfLine();
        exec(inputBuffer);
    }
    // Handle C-c
    else if (e.ctrlKey && e.keyCode === 67) {
        e.preventDefault();
        this.value += "\n$ ";
        cursorPos = beginningOfLine();
    }
    // Handle C-l (clear screen)
    else if (e.ctrlKey && e.keyCode === 76) {
        clear();
    }
    // Handle delete and backspace
    else if (e.keyCode === 8 || e.keyCode === 46) {
        if (atBeginningOfLine()) {
            e.preventDefault();
        } else {
            --cursorPos;
        }
    }
    // Disable tab (for now, will do completion eventually)
    else if (e.keyCode === 9) {
        e.preventDefault();
    }
    // Disable C-p and C-n (line movement)
    else if (e.ctrlKey && (e.keyCode === 78 || e.keyCode === 80)) {
        e.preventDefault();
    }
    // C-a: Move to beginning of input
    else if (e.ctrlKey && e.keyCode === 65) {
        e.preventDefault();
        cursorPos = this.selectionStart = this.selectionEnd = beginningOfLine();
    }
    // C-b: Move backward
    else if (e.ctrlKey && e.keyCode === 66) {
        if (atBeginningOfLine()) {
            e.preventDefault();
        } else {
            --cursorPos;
        }
    }
    // Handle arrow keys
    else if (e.keyCode >= 37 && e.keyCode <= 40) {
        switch (e.keyCode) {
        case 37:
            if (atBeginningOfLine()) {
                e.preventDefault();
            }
            break;
        case 38:
        case 40:
            e.preventDefault();
        }
    }
    // All other keys
    else {
        cursorPos = this.selectionStart + 1;
    }
}

function prompt() {
    return pwd + " $ ";
}

function currentLine() {
    return (jshTextArea.value.match(/\n/g)||[]).length;
}

function beginningOfLine() {
    let pos;
    if ((pos = jshTextArea.value.lastIndexOf("\n")) === -1) {
        return prompt().length;
    }
    return pos + prompt().length + 1;
}

function atBeginningOfLine() {
    return jshTextArea.selectionStart <= 2 ||
        jshTextArea.selectionStart <= beginningOfLine();
}

function output(str) {
    if (str.length > 0) {
        jshTextArea.value += "\n" + str + "\n" + prompt();
        inputBuffer = "";
    } else {
        jshTextArea.value += "\n" + prompt();
    }
    jshTextArea.scrollTop = jshTextArea.scrollHeight;
    cursorPos = jshTextArea.selectionStart;
}

var validCommands = ["cat", "cd", "clear", "exit", "help", "ls", "open", "snake"];

function exec(input) {
    if (input.length === 0) {
        output("");
    } else {
        let tokens = input.split(/\s/).filter(function (str) {
            return !!str;
        });

        let command = tokens[0];

        if (validCommands.includes(command)) {
            if (command === "cat") {
                cat(tokens.slice(1));
            } else if (command === "clear") {
                clear();
            } else if (command === "cd") {
                cd(tokens.slice(1));
            } else if (command === "exit") {
                window.location.href = "/about"
            } else if (command === "help") {
                help();
            } else if (command === "ls") {
                ls(tokens.slice(1));
            } else if (command === "open") {
                open(tokens.slice(1));
            } else if (command === "snake") {
                showSnake();
                game.play();
            }
        } else {
            output("command not found: " + command);
        }
    } 
}

function findFile(filename, dir = fs) {
    if (!dir || !filename) {
        return false;
    }

    let path = filename.split("/");
    let obj;

    for (let i = 0; i < dir.length; ++i) {
        if (dir[i].name === filename) {
            return dir[i];
        } 

        if ((obj = findFile(path.slice(1).join("/"), dir[i].files))) {
            return obj;
        }
    }

    return false;
}

function cat(args) {
    if (args.length === 0) {
        output("");
    } else {
        let entity = findFile(pwd + "/" + args[0]);
        if (entity.data) {
            output(entity.data);
        } else {
            output("cat: " + args[0] + " is a directory");
        }
    }
}

function cd(args) {
    if (args.length === 0) {
        pwd = "~";
        output("");
    } else if (args[0] === "..") {
        let parent = findFile(pwd).parent;
        pwd = parent;
        output("");
    } else {
        let path = findFile(pwd + "/" + args[0]);
        if (path && path.parent) {
            pwd += "/" + path.name;
            output("");
        } else if (!path.parent) {
            output("cd: " + args[0] + " is not a directory ");
        } else {
            output("cd: no such file or directory " + args[0]);
        }
    }
}

function clear() {
    jshTextArea.value = prompt();
    cursorPos = prompt().length;
    inputBuffer = "";
}

function help() {
    let commandStr = "[" + validCommands.join(", ") + "]";
    var helpStr = `Commands: [${validCommands.join(", ")}]\n\n`

    helpStr += `cat - Output a file to the the terminal.
cd - Change directories.
clear - Clear the terminal screen.
exit - View the rest of the site.
help - Print this message.
ls - List files in a directory.
open - Jump to a page in the site.
snake - Arrow keys to move, 'q' to quit.
`
    output(helpStr);
}

function ls(args) {
    let str = "";
    let files, entity;

    if (args.length > 0) {
        entity = findFile(pwd + "/" + args[0], fs);
    } else {
        entity = findFile(pwd, fs);
    }

    if (!entity) {
        output("ls: no such file or directory " + args[0]);
        return;
    }

    if (entity.data) { // It's a file.
        files = [args[0]]; 
    } else {
        files = entity.files;
    }

    for (let i = 0; i < files.length; ++i) {
        str += files[i].name || files[i];
        if (i != files.length - 1) {
            str += " ";
        }
    }

    output(str);
}

function open(args) {
    if (args.length === 0) {
        output("open: must be provided an argument");
    } else {
        let entity = findFile(pwd + "/" + args[0]);

        if (entity && entity.data && entity.name.includes(".md")) {
            clear();
            let url;
            if (pwd != "~") {
                url = pwd.replace("~", "") + "/" + args[0].replace(".md", "");
            } else {
                url = args[0].replace(".md", "");

            }
            window.location.href = url;
        } else if (entity && entity.data) {
            output("open: can only open files with '.md' extension. try `cat` to view source code.");
        } else if (entity && !entity.data) {
            output("open: " + args[0] + " is a directory");
        } else {
            output("open: no such file or directory " + args[0]);
        }
    }
}

function showSnake() {
    clear();
    snakeCanvas.style.display = "block";
    jshTextArea.style.display = "none";
}

function hideSnake() {
    snakeCanvas.style.display = "none";
    jshTextArea.style.display = "block";
}

var welcomeStr = "Welcome! I'm AJ Bond, an electrical engineering student at Texas A&M University.\n\nI’m seeking an entry-level electrical engineering or software engineering position.\n\nI’ve excelled in classes including Computer Architecture, Digital Design, Circuits, Statistics, Data Structures & Algorithms, Electromagnetics, and Systems Programming.\n\nI also have strong communication skills and an excellent academic record.\n\nType `help` for available commands, or type `exit` to view the rest of the site.\n"

var introInterval;

function init() {
    jshTextArea.removeEventListener("keydown", disableKeyboard);
    jshTextArea.addEventListener("keydown", handleKeydown);
}

function disableKeyboard(e) {
    e.preventDefault();
    e.stopPropagation();
    clear();
    clearInterval(introInterval);
    output(welcomeStr);
    init();
}

snakeCanvas.width = "800";
snakeCanvas.height = "500";

window.onload = function() {
    game = new Game(snakeCanvas);

    jshTextArea.focus();
    jshTextArea.spellcheck = false;
    jshTextArea.textContent = prompt();
    jshTextArea.selectionStart = prompt().length;

    jshTextArea.addEventListener("keydown", disableKeyboard);

    let i = 0;
    introInterval = setInterval(function() {
        if (welcomeStr[i]) {
            jshTextArea.value += welcomeStr[i++];
            cursorPos += 1;
        } else {
            clearInterval(introInterval);
            init();
            output("");
        }
    }, 50);

}
