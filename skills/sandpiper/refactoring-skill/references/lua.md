# Lua Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **luacheck** | Linting, unused variables, globals, style | Fast |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection | Fast |

luacheck is the primary tool. It catches the most impactful Lua issues (accidental
globals, unused variables, shadowing, unreachable code) and supports per-project
configuration. lizard provides per-function CC since luacheck doesn't measure
complexity directly.

## Tool Commands

### luacheck — Primary linter

```bash
# Run with parseable output
luacheck --formatter plain --codes --ranges <path>

# Run with specific checks
luacheck --no-unused-args --std max <path>

# Configure for specific environments (Neovim, Love2D, OpenResty, etc.)
luacheck --std luajit+love <path>
luacheck --globals vim --read-globals describe,it,before_each <path>
```

Configure in `.luacheckrc`:
```lua
std = "max"           -- allow all standard Lua globals
max_line_length = 120
max_cyclomatic_complexity = 15   -- if supported by version

-- For Neovim plugins
globals = { "vim" }
read_globals = { "describe", "it", "before_each", "after_each" }

-- For Love2D
stds.love = { globals = { "love" } }
std = "luajit+love"

-- Ignore specific warnings per-directory
files["spec/**"] = { std = "+busted" }
```

Key luacheck codes for refactoring:
- `111`: Setting undefined global variable (almost always a bug — missing `local`)
- `112`: Mutating undefined global variable
- `113`: Accessing undefined global variable
- `211`: Unused local variable
- `212`: Unused argument
- `213`: Unused loop variable (use `_` for intentionally unused)
- `311`: Value assigned to variable but never accessed
- `411`: Variable redefining another variable in the same scope
- `421`: Shadowing a local variable
- `531`: Left-hand side of assignment is unreachable

### lizard — Complexity measurement

```bash
# Lua CC per-function
lizard -l lua --csv <path>

# Filter high complexity functions
lizard -l lua -T cyclomatic_complexity=15 <path>
```

## Language-Specific Refactoring Patterns

### Eliminate accidental globals with local declarations

This is the single highest-impact refactoring in Lua codebases. Every non-local
variable pollutes the global table, causing hard-to-debug cross-module interactions.

```lua
-- Before: implicit globals everywhere
function processItems(items)
    result = {}           -- accidental global!
    for i = 1, #items do
        item = items[i]   -- accidental global!
        if item.valid then
            count = count + 1   -- accidental global (and uninitialized!)
            table.insert(result, transform(item))
        end
    end
    return result
end

-- After: explicit locals
local function processItems(items)
    local result = {}
    local count = 0
    for i = 1, #items do
        local item = items[i]
        if item.valid then
            count = count + 1
            table.insert(result, transform(item))
        end
    end
    return result
end
```

### Replace module globals with returned table

```lua
-- Before: setting globals (Lua 5.0 pattern, still common)
module("mymodule", package.seeall)

function doSomething()
    -- ...
end

function doSomethingElse()
    -- ...
end

-- After: return a table (modern Lua pattern)
local M = {}

local function helperFunction()
    -- private to this module
end

function M.doSomething()
    helperFunction()
    -- ...
end

function M.doSomethingElse()
    -- ...
end

return M
```

### Flatten nested conditionals with early returns

```lua
-- Before: deeply nested
local function validate(data)
    if data then
        if data.name then
            if #data.name > 0 then
                if data.age then
                    if data.age >= 0 then
                        return true
                    end
                end
            end
        end
    end
    return false
end

-- After: guard clauses
local function validate(data)
    if not data then return false end
    if not data.name then return false end
    if #data.name == 0 then return false end
    if not data.age then return false end
    if data.age < 0 then return false end
    return true
end
```

### Replace string concatenation loops with table.concat

```lua
-- Before: O(n²) string building
local function buildCSV(rows)
    local result = ""
    for _, row in ipairs(rows) do
        local line = ""
        for j, val in ipairs(row) do
            if j > 1 then line = line .. "," end
            line = line .. tostring(val)
        end
        result = result .. line .. "\n"
    end
    return result
end

-- After: O(n) with table.concat
local function buildCSV(rows)
    local lines = {}
    for _, row in ipairs(rows) do
        local fields = {}
        for _, val in ipairs(row) do
            fields[#fields + 1] = tostring(val)
        end
        lines[#lines + 1] = table.concat(fields, ",")
    end
    return table.concat(lines, "\n")
end
```

### Extract OOP boilerplate into a base constructor

```lua
-- Before: repeated constructor pattern in every "class"
local Dog = {}
Dog.__index = Dog
function Dog.new(name, breed)
    local self = setmetatable({}, Dog)
    self.name = name
    self.breed = breed
    return self
end

local Cat = {}
Cat.__index = Cat
function Cat.new(name, color)
    local self = setmetatable({}, Cat)
    self.name = name
    self.color = color
    return self
end

-- After: shared class helper
local function newclass()
    local cls = {}
    cls.__index = cls
    function cls:new(...)
        local instance = setmetatable({}, cls)
        if instance.init then instance:init(...) end
        return instance
    end
    return cls
end

local Dog = newclass()
function Dog:init(name, breed)
    self.name = name
    self.breed = breed
end

local Cat = newclass()
function Cat:init(name, color)
    self.name = name
    self.color = color
end
```

### Replace deeply chained metamethods with explicit delegation

```lua
-- Before: long __index chains (hard to debug, hidden performance cost)
Base.__index = Base
Child.__index = Child
setmetatable(Child, { __index = Base })
GrandChild.__index = GrandChild
setmetatable(GrandChild, { __index = Child })
-- Lookup traverses 3 tables on every miss

-- After: copy methods explicitly at class creation (one-time cost)
local function inherit(child, parent)
    for k, v in pairs(parent) do
        if child[k] == nil then
            child[k] = v
        end
    end
end

inherit(Child, Base)
inherit(GrandChild, Child)
-- Lookup is direct table access, no chain traversal
```

### Localize hot-path globals

```lua
-- Before: repeated global lookups in tight loop
local function processMany(items)
    local results = {}
    for i = 1, #items do
        if type(items[i]) == "string" then
            table.insert(results, string.upper(items[i]))
        end
    end
    return results
end

-- After: localized globals (idiomatic Lua optimization)
local type = type
local upper = string.upper

local function processMany(items)
    local results = {}
    local n = 0
    for i = 1, #items do
        if type(items[i]) == "string" then
            n = n + 1
            results[n] = upper(items[i])
        end
    end
    return results
end
```

## Lua-Specific Anti-Patterns

- **Don't use `module()` and `package.seeall`.** They pollute the global namespace
  and were deprecated in Lua 5.2. Return a table instead.
- **Don't use `arg` as a variable name in functions.** In Lua 5.0 it shadows the
  built-in `arg` table; in 5.1+ with varargs it's confusing. Use descriptive names.
- **Don't rely on `#` for tables with holes.** The result is undefined. Track length
  explicitly or use `table.move` / iteration.
- **Don't create deep metatables chains (> 2 levels).** Each lookup traverses the
  entire chain. Copy methods explicitly or flatten the hierarchy.
- **Don't use `loadstring`/`load` for configuration.** Use data files (JSON, INI)
  or structured Lua tables. Code-as-config is a security risk.
- **Don't mix `:` and `.` for method calls on the same object.** Pick one convention
  and stick with it. `:` passes self, `.` does not — mixing them causes subtle bugs.
- **Don't use `os.execute` or `io.popen` with unsanitized input.** Same injection
  risks as any other language.
