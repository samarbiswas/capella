# Capella

<img src="images/icon.png" width="96" alt="Capella icon">

A pitch-black dark theme for VS Code that is easy on the eyes: named after Capella, a warm golden star in a dark sky. Every colour has a meaning, so you can read
code by its colour alone.

## Why this theme
- **Pure black editor** (`#000000`). Great on OLED screens and in dark rooms.
- **Soft colours.** Each colour is slightly toned down so nothing glows or glares on black.
- **Off-white text** (`#e6e6e3`) instead of pure white, for less eye strain in long sessions.
- **Panels one step lighter** (`#0a0a0a`) so the editor stands out.
- **Italic only where it helps:** comments, function inputs, and declaring words such as `def`, `class`, `let`, `const`.

## What each colour means
| Colour | Hex | Meaning | Examples |
|---|---|---|---|
| Soft pink | `#f0708f` | Control: words that change the flow | `if`, `return`, `raise`, `import`, `and`, `not` |
| Soft gold | `#d4b866` | Text data (a little quieter than names, so data never hides logic) | `"hello"` |
| Lavender | `#a99ce8` | Fixed values | `42`, `True`, `None`, `Math.PI`, enum members |
| Green | `#a3d27a` | Actions: functions and methods | `print()`, `save()` |
| Cyan | `#7ccfdb` | Shapes: types and classes | `str`, `List`, `User` |
| Pink italic | `#f0708f` | Define words (quiet, so the name after them stands out) | `def`, `class`, `function`, `let`, `const`, `interface` |
| Orange italic | `#f09a6e` | Inputs: function parameters | `def f(name, age)` |
| Off-white | `#e6e6e3` | Plain names: variables, `const` names, properties, HTML attributes, CSS properties, YAML keys | `total`, `user.email`, `href` |
| Grey italic | `#807e81` | Notes for humans: comments | `# todo` |
| Dim grey | `#939293` | Glue: brackets, commas, dots, operators | `( ) , .` `=` `+` `<` |
| Red underline | `#ff5f6d` | Danger: invalid code (a stronger red than keywords) | |

The interface follows the same meanings: errors are red, deleted files pink, warnings orange, new files green, changed
files orange. The interface accent is soft white, so gold always means text data. Terminal blue is a real soft blue (`#8cb4e8`). Nested brackets each get their own dim tint, so pairs are easy to match but stay in the background. Diffs and merge conflicts use the same soft green (added) and pink (removed). In Markdown, headings are soft white and bold, and bold text is simply bold.

## The Capella panel
Click the **star icon** in the left sidebar to open the Capella settings window.

- **Theme:** a slider for how black the background is, from pure black `#000000` (best on OLED screens and in dark
  rooms) to soft charcoal `#1a1a1a`. Panels stay one step lighter. Click **Apply** to save it, **Reset** to undo.
  It only changes Capella (saved in your user settings under `workbench.colorCustomizations` → `[Capella]`), never
  your other themes, and it keeps any other Capella colours you set yourself. Reset puts back the background
  colours you had before Capella first changed them. Workspace settings can override your user settings.
- Coming next: fonts (1.3), a minimal agentic workspace starter (1.4), and file icons (1.5).

## Recommended fonts
A colour theme cannot choose your font, so pick one yourself. Capella uses italic to carry meaning (comments, inputs,
`def` / `let`), so it looks best with a font that has a real, designed italic. All of these are free:

| Font | Why it suits Capella |
|---|---|
| [Cascadia Code](https://github.com/microsoft/cascadia-code) | Clean, with a handwriting-style italic made for code |
| [Victor Mono](https://rubjo.github.io/victor-mono/) | A very clear cursive italic; thin and calm on black |
| [Monaspace](https://monaspace.githubnext.com/) | A family of five styles; use one for code and another for italics |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | Very readable; its italic is only slanted, so less distinct |

Install the font, then add this to your VS Code `settings.json`:

```json
"editor.fontFamily": "'Cascadia Code', Menlo, Consolas, monospace",
"editor.fontLigatures": true,
"editor.fontSize": 14,
"editor.lineHeight": 1.6
```

`fontLigatures` joins symbols such as `->` and `!=` into one shape. Turn it off if you prefer to see each character.

## Install
**From source**
1. Download or clone this repository.
2. Copy the folder to your VS Code extensions folder:
   - macOS / Linux: `~/.vscode/extensions/samarbiswas.capella`
   - Windows: `%USERPROFILE%\.vscode\extensions\samarbiswas.capella`
3. Restart VS Code.
4. Press `Cmd+K Cmd+T` (macOS) or `Ctrl+K Ctrl+T` (Windows / Linux) and choose **Capella**.

**As a package**
```
npm install -g @vscode/vsce
vsce package
code --install-extension capella-1.1.0.vsix
```

## Contributing
Ideas and fixes are welcome. Open an issue or a pull request.

## License
[MIT](LICENSE) © 2026 Samar Biswas
