---
title: "Command escaping round-trip tests"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:30:24-05:00
---

# Command escaping round-trip tests

Test `string escape`/`string unescape` round-trip with adversarial inputs:

- Simple commands: `ls -la`, `echo hello`
- Pipes: `cat file | grep pattern`
- Redirections: `echo hello > file.txt`
- Single quotes: `grep 'hello world' file`
- Double quotes: `echo "hello $USER"`
- Mixed quotes: `echo "it's a 'test'"`
- Dollar signs and variables: `echo $HOME`
- Backticks: `` echo `date` ``
- Subcommands: `echo $(date)`
- Semicolons: `cmd1; cmd2`
- Logical operators: `cmd1 && cmd2 || cmd3`
- Newlines in commands
- Empty strings
- Unicode characters
