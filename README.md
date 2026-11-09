# Lantern

A pitch-black dark theme for VS Code that is easy on the eyes: soft lights in the dark. Every colour has a meaning, so you can read
code by its colour alone.

## Why this theme
- **Pure black editor** (`#000000`). Great on OLED screens and in dark rooms.
- **Soft colours.** Each colour is slightly toned down so nothing glows or glares on black.
- **Off-white text** (`#e6e6e3`) instead of pure white, for less eye strain in long sessions.
- **Panels one step lighter** (`#0a0a0a`) so the editor stands out.
- **Italic only where it helps:** comments, function inputs, and the words `def` / `class` / `function`.

## What each colour means
| Colour | Hex | Meaning | Examples |
|---|---|---|---|
| Soft pink | `#f0708f` | Control: words that change the flow | `if`, `return`, `raise`, `import`, `and`, `not` |
| Soft gold | `#d4b866` | Text data (a little quieter than names, so data never hides logic) | `"hello"` |
| Lavender | `#a99ce8` | Fixed values | `42`, `True`, `None`, constants |
| Green | `#a3d27a` | Actions: functions and methods | `print()`, `save()` |
| Cyan | `#7ccfdb` | Shapes: types and classes | `str`, `List`, `User` |
| Pink italic | `#f0708f` | Define words (quiet, so the name after them stands out) | `def`, `class`, `function` |
| Orange italic | `#f09a6e` | Inputs: function parameters | `def f(name, age)` |
| Off-white | `#e6e6e3` | Plain names: variables, properties | `total`, `user.email` |
| Grey italic | `#807e81` | Notes for humans: comments | `# todo` |
| Dim grey | `#939293` | Glue: brackets, commas, dots, operators | `( ) , .` `=` `+` `<` |
| Red underline | `#ff5f6d` | Danger: invalid code (a stronger red than keywords) | |

The interface follows the same meanings: errors are red, deleted files pink, warnings orange, new files green, changed
files orange. The interface accent is soft white, so gold always means text data. Terminal blue is a real soft blue (`#8cb4e8`). Nested brackets each get their own dim tint, so pairs are easy to match but stay in the background.

## Install
**From source**
1. Download or clone this repository.
2. Copy the folder to your VS Code extensions folder:
   - macOS / Linux: `~/.vscode/extensions/lantern`
   - Windows: `%USERPROFILE%\.vscode\extensions\lantern`
3. Restart VS Code.
4. Press `Cmd+K Cmd+T` (macOS) or `Ctrl+K Ctrl+T` (Windows / Linux) and choose **Lantern**.

**As a package**
```
npm install -g @vscode/vsce
vsce package
code --install-extension lantern-1.0.0.vsix
```

## Contributing
Ideas and fixes are welcome. Open an issue or a pull request.

## License
[MIT](LICENSE) © 2026 Samar Biswas
